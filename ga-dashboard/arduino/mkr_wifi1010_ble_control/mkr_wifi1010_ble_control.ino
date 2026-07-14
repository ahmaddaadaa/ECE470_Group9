/*
 * ECE 470 Group 9 — MKR WIFI 1010 BLE (keep-alive stable)
 *
 * Goal: stay connected more than a few seconds.
 * - Minimal notify traffic (one status string, ~1 Hz)
 * - No connection-interval tricks
 * - Actuators only change on command (not at connect)
 *
 * Name: G9
 * Browser writes: "N,M,C,H"
 * Board notifies: "E=+0.00"  (pot extra heat on A1)
 */

#include <ArduinoBLE.h>
#include <Servo.h>
#include <stdio.h>
#include <string.h>

const int PIN_LED_N  = 2;
const int PIN_SERVO  = 3;
const int PIN_FAN    = 4;
const int PIN_LED_H  = 5;
const int PIN_POT    = A1;
const int STATUS_LED = LED_BUILTIN;

// Must match src/ble/arduinoBle.js
const char* SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214";
const char* CMD_UUID     = "19b10001-e8f2-537e-4f6c-d104768a1214";
const char* TEMP_UUID    = "19b10002-e8f2-537e-4f6c-d104768a1214";
const char* STATUS_UUID  = "19b10003-e8f2-537e-4f6c-d104768a1214";

BLEService service(SERVICE_UUID);
// Write only for commands
BLECharacteristic cmdChar(CMD_UUID, BLEWrite | BLEWriteWithoutResponse, 20);
// Read+notify for pot heat text "E=+x.xx"
BLECharacteristic statusChar(STATUS_UUID, BLERead | BLENotify, 12);
// Optional temp (read only, no notify — less radio load)
BLEFloatCharacteristic tempChar(TEMP_UUID, BLERead);

uint8_t levelN = 0, levelM = 0, levelC = 0, levelH = 0;
float simT = 37.0f;
const float W_N = 0.20f, W_M = 0.28f, W_C = 0.65f, W_H = 0.55f;

// Level 1 must overcome motor stiction — keep floor high enough to spin
const int FAN_MIN_PWM = 175;   // raise if C=1 still stalls; lower if too aggressive
const int FAN_KICK_PWM = 255;  // short full-speed kick when starting from 0
const int LED_MIN_PWM = 70;    // level 1 LEDs still clearly visible
// Mixing: position servo sweeps LEFT <-> RIGHT hard (demo "crazy mix")
// Higher M = wider angle + faster sweep
const int MIX_LEFT = 0;
const int MIX_RIGHT = 180;
const int MIX_CENTER = 90;

Servo mixServo;
bool servoReady = false;
uint8_t lastLevelC = 0;
unsigned long lastNotifyMs = 0;
unsigned long linkUpMs = 0;
unsigned long fanKickUntilMs = 0;
// mix sweep state
int mixAngle = 90;
int mixDir = 1; // +1 toward 180, -1 toward 0
unsigned long lastMixStepMs = 0;

uint8_t clampL(int v) {
  if (v < 0) return 0;
  if (v > 7) return 7;
  return (uint8_t)v;
}

float readExtraHeat() {
  int raw = analogRead(PIN_POT);
  static int f = -1;
  if (f < 0) f = raw;
  f = (f + raw) / 2;
  float e = (f / 1023.0f) * 5.0f - 2.5f;
  if (e < -2.5f) e = -2.5f;
  if (e > 2.5f) e = 2.5f;
  return e;
}

void ensureServo() {
  if (!servoReady) {
    mixServo.attach(PIN_SERVO);
    mixServo.write(90);
    servoReady = true;
  }
}

// Map level 0..7 → PWM with a usable floor at level 1 (LEDs + motors)
int levelToLedPwm(uint8_t level) {
  if (level == 0) return 0;
  return map((int)level, 1, 7, LED_MIN_PWM, 255);
}

int levelToFanPwm(uint8_t level) {
  if (level == 0) return 0;
  // slightly more than linear so low levels get more drive
  // level 1 → FAN_MIN_PWM, level 7 → 255
  int base = map((int)level, 1, 7, FAN_MIN_PWM, 255);
  // boost mid-low a bit (levels 1–3)
  if (level <= 3) {
    base = min(255, base + 15);
  }
  return base;
}

// Step size (degrees) per tick — full left/right bangs
// M=1 already uses huge steps so the demo is obvious
int mixStepDegrees(uint8_t level) {
  if (level == 0) return 0;
  // L1 already ~full travel each jump; higher M only slightly bigger
  static const int step[8] = {0, 90, 100, 120, 140, 160, 180, 180};
  if (level > 7) level = 7;
  return step[level];
}

// Time between steps (ms) — M=1 is already fast
unsigned long mixStepPeriodMs(uint8_t level) {
  if (level == 0) return 9999;
  // L1 ~45ms (very visible), L7 ~18ms (max)
  static const unsigned long per[8] = {9999, 45, 40, 35, 30, 25, 20, 18};
  if (level > 7) level = 7;
  return per[level];
}

// Call often from loop(): bangs servo left/right
void updateMixingSweep() {
  if (levelM == 0) {
    if (servoReady) {
      mixAngle = MIX_CENTER;
      mixServo.write(MIX_CENTER);
    }
    return;
  }

  ensureServo();
  unsigned long now = millis();
  if (now - lastMixStepMs < mixStepPeriodMs(levelM)) return;
  lastMixStepMs = now;

  int step = mixStepDegrees(levelM);
  mixAngle += mixDir * step;

  // bounce hard at ends (full 0..180 travel)
  if (mixAngle >= MIX_RIGHT) {
    mixAngle = MIX_RIGHT;
    mixDir = -1;
  } else if (mixAngle <= MIX_LEFT) {
    mixAngle = MIX_LEFT;
    mixDir = 1;
  }

  mixServo.write(mixAngle);
}

void applyActuators() {
  // Nutrients + Heating LEDs: brighter at low levels
  analogWrite(PIN_LED_N, levelToLedPwm(levelN));
  analogWrite(PIN_LED_H, levelToLedPwm(levelH));

  // Cooling fan: short full-speed kick when leaving 0 (non-blocking)
  if (levelC == 0) {
    analogWrite(PIN_FAN, 0);
    fanKickUntilMs = 0;
  } else {
    if (lastLevelC == 0) {
      fanKickUntilMs = millis() + 150;
      analogWrite(PIN_FAN, FAN_KICK_PWM);
    } else if (fanKickUntilMs == 0 || millis() >= fanKickUntilMs) {
      fanKickUntilMs = 0;
      analogWrite(PIN_FAN, levelToFanPwm(levelC));
    }
  }
  lastLevelC = levelC;

  // Mixing: start sweep immediately when M becomes non-zero
  if (levelM > 0) {
    ensureServo();
    mixDir = 1;
    mixAngle = MIX_LEFT;
    mixServo.write(MIX_LEFT);
    lastMixStepMs = 0; // next loop tick will move
  } else if (servoReady) {
    mixAngle = MIX_CENTER;
    mixServo.write(MIX_CENTER);
  }
}

bool parseCmd(const uint8_t* data, int len) {
  if (!data || len <= 0) return false;
  char buf[24];
  if (len >= (int)sizeof(buf)) len = sizeof(buf) - 1;
  memcpy(buf, data, len);
  buf[len] = 0;
  int n = 0, m = 0, c = 0, h = 0;
  if (sscanf(buf, "%d,%d,%d,%d", &n, &m, &c, &h) != 4) return false;
  levelN = clampL(n);
  levelM = clampL(m);
  levelC = clampL(c);
  levelH = clampL(h);
  return true;
}

void handleCmd() {
  if (!parseCmd(cmdChar.value(), cmdChar.valueLength())) return;
  applyActuators();
}

void onWritten(BLEDevice, BLECharacteristic) {
  handleCmd();
}

void sendStatusE() {
  float e = readExtraHeat();
  char msg[12];
  snprintf(msg, sizeof(msg), "E=%+.2f", e);
  statusChar.writeValue((const uint8_t*)msg, strlen(msg));

  // update plant + readable temp (no notify)
  float d = W_N * levelN + W_H * levelH - W_C * levelC - W_M * levelM;
  simT += 0.12f * d + 0.15f * e + 0.01f * (37.0f - simT);
  if (simT < 20) simT = 20;
  if (simT > 50) simT = 50;
  tempChar.writeValue(simT);
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_LED_N, OUTPUT);
  pinMode(PIN_LED_H, OUTPUT);
  pinMode(PIN_FAN, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);
  pinMode(PIN_POT, INPUT);

  analogWrite(PIN_LED_N, 0);
  analogWrite(PIN_LED_H, 0);
  analogWrite(PIN_FAN, 0);
  // Servo attaches only when first mixing command arrives (saves power at connect)

  delay(200);

  if (!BLE.begin()) {
    while (true) {
      digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
      delay(100);
    }
  }

  BLE.setLocalName("G9");
  BLE.setDeviceName("G9");

  service.addCharacteristic(cmdChar);
  service.addCharacteristic(statusChar);
  service.addCharacteristic(tempChar);
  BLE.addService(service);
  BLE.setAdvertisedService(service);

  cmdChar.setEventHandler(BLEWritten, onWritten);

  {
    const char* z = "E=+0.00";
    statusChar.writeValue((const uint8_t*)z, 7);
  }
  tempChar.writeValue(37.0f);

  BLE.setAdvertisingInterval(160);
  BLE.advertise();

  if (Serial) Serial.println(F("G9 up — advertising"));
}

void loop() {
  // Always poll — critical for keeping the link
  BLE.poll();

  // Finish fan start kick without delay() (keeps BLE happy)
  if (fanKickUntilMs != 0 && millis() >= fanKickUntilMs) {
    fanKickUntilMs = 0;
    if (levelC > 0) analogWrite(PIN_FAN, levelToFanPwm(levelC));
  }

  // Crazy left/right mix whenever M > 0 (works even if BLE idle)
  updateMixingSweep();

  if (cmdChar.written()) handleCmd();

  BLEDevice central = BLE.central();
  if (!central || !central.connected()) {
    if (linkUpMs != 0) {
      linkUpMs = 0;
      if (Serial) Serial.println(F("link down"));
      BLE.advertise();
    }
    digitalWrite(STATUS_LED, (millis() / 500) & 1);
    static unsigned long lastAdv = 0;
    if (millis() - lastAdv > 3000) {
      lastAdv = millis();
      BLE.advertise();
    }
    return;
  }

  if (linkUpMs == 0) {
    linkUpMs = millis();
    lastNotifyMs = millis();
    digitalWrite(STATUS_LED, HIGH);
    if (Serial) Serial.println(F("link up"));
  }

  // First 1.5 s after connect: only poll + mix sweep, light notify load
  if (millis() - linkUpMs < 1500) {
    return;
  }

  if (millis() - lastNotifyMs >= 1000) {
    lastNotifyMs = millis();
    sendStatusE();
  }
}
