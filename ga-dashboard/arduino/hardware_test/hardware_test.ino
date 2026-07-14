/*
 * ECE470 – quick hardware test for MKR WIFI 1010 wiring
 *
 * Pin map (labels ON the board, no "D"):
 *   2  = Nutrients LED
 *   3  = Servo signal (mixing)
 *   4  = Fan via transistor / ULN (cooling)
 *   5  = Heating LED
 *   A1 = 10k pot (disturbance)
 *   3V3 / GND = pot ends
 *
 * Open Serial Monitor @ 115200
 * Type:  a=all  l=leds  s=servo  f=fan  p=pot  0=off
 */

#include <Servo.h>

const int PIN_LED_N = 2;
const int PIN_SERVO = 3;
const int PIN_FAN   = 4;
const int PIN_LED_H = 5;
const int PIN_POT   = A1;

Servo mixServo;

void allOff() {
  digitalWrite(PIN_LED_N, LOW);
  digitalWrite(PIN_LED_H, LOW);
  analogWrite(PIN_FAN, 0);
  mixServo.write(90);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED_N, OUTPUT);
  pinMode(PIN_LED_H, OUTPUT);
  pinMode(PIN_FAN, OUTPUT);
  mixServo.attach(PIN_SERVO);
  allOff();

  delay(1500);
  Serial.println(F("=== ECE470 hardware test ==="));
  Serial.println(F("Commands: a=all  l=leds  s=servo  f=fan  p=pot loop  0=off"));
  Serial.println(F("Running auto sequence once..."));
  runAllOnce();
  Serial.println(F("Done auto. Send a letter command, or wait."));
}

void blinkLeds() {
  Serial.println(F("[LEDs] N and H blink"));
  for (int i = 0; i < 4; i++) {
    digitalWrite(PIN_LED_N, HIGH);
    digitalWrite(PIN_LED_H, LOW);
    delay(250);
    digitalWrite(PIN_LED_N, LOW);
    digitalWrite(PIN_LED_H, HIGH);
    delay(250);
  }
  digitalWrite(PIN_LED_N, LOW);
  digitalWrite(PIN_LED_H, LOW);
}

void testServo() {
  Serial.println(F("[Servo] sweep 0 -> 180 -> 90"));
  for (int a = 0; a <= 180; a += 5) {
    mixServo.write(a);
    delay(30);
  }
  for (int a = 180; a >= 0; a -= 5) {
    mixServo.write(a);
    delay(30);
  }
  mixServo.write(90);
}

void testFan() {
  Serial.println(F("[Fan] ramp 0 -> full -> 0  (listen for spin)"));
  for (int p = 0; p <= 255; p += 15) {
    analogWrite(PIN_FAN, p);
    delay(80);
  }
  delay(800);
  for (int p = 255; p >= 0; p -= 15) {
    analogWrite(PIN_FAN, p);
    delay(80);
  }
  analogWrite(PIN_FAN, 0);
}

void testPot(int seconds) {
  Serial.println(F("[Pot] turn knob — A1 raw and 0-100%"));
  unsigned long end = millis() + (unsigned long)seconds * 1000UL;
  while (millis() < end) {
    int raw = analogRead(PIN_POT);
    int pct = map(raw, 0, 1023, 0, 100);
    Serial.print(F("  A1 raw="));
    Serial.print(raw);
    Serial.print(F("  ~"));
    Serial.print(pct);
    Serial.println(F("%  (disturbance)"));
    // also light LEDs proportional to pot as visual feedback
    analogWrite(PIN_LED_N, map(raw, 0, 1023, 0, 255));
    analogWrite(PIN_LED_H, map(raw, 0, 1023, 255, 0));
    delay(200);
  }
  digitalWrite(PIN_LED_N, LOW);
  digitalWrite(PIN_LED_H, LOW);
}

void runAllOnce() {
  blinkLeds();
  delay(300);
  testServo();
  delay(300);
  testFan();
  delay(300);
  testPot(8);
  allOff();
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') return;
    allOff();
    switch (c) {
      case 'a':
      case 'A':
        runAllOnce();
        break;
      case 'l':
      case 'L':
        blinkLeds();
        break;
      case 's':
      case 'S':
        testServo();
        break;
      case 'f':
      case 'F':
        testFan();
        break;
      case 'p':
      case 'P':
        testPot(15);
        break;
      case '0':
        allOff();
        Serial.println(F("All off"));
        break;
      default:
        Serial.println(F("Use: a l s f p 0"));
        break;
    }
  }
}
