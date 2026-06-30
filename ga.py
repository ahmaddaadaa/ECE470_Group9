import random

# makes a random 12 bit binary list (our chromosome)
def create_chromosome():
    return [random.randint(0, 1) for _ in range(12)]

#breaks that chromoms into 3 bit chunks one for each action 
def break_chromosome(chromosome):
    cooling   = chromosome[0:3]
    heating   = chromosome[3:6]
    mixing = chromosome[6:9]
    nutrients   = chromosome[9:12]
    return cooling, heating, mixing, nutrients


# converts a 3 bit chunk to a percentage (0.0 to 1.0)
def bits_to_percent(bits):
    value = bits[0]*4 + bits[1]*2 + bits[2]*1 
    return value / 7 

# basic simulator (we should tweak the scaler based on some reasearch but if not its just a proof of concept)
def simulate_temperature(chromosome, current_temp):
    cooling, heating, mixing, nutrients = break_chromosome(chromosome)
    
    delta_T = (
        -12 * bits_to_percent(cooling)
        + 8  * bits_to_percent(heating)
        - 4  * bits_to_percent(mixing)
        + 6  * bits_to_percent(nutrients)
        + random.uniform(-0.5, 0.5)  # noise
    )
    return current_temp + delta_T

def calculate_fitness(chromosome, final_temp):
    cooling, heating, mixing, nutrients = break_chromosome(chromosome)

    cost = (sum(cooling) * 5) + (sum(heating) * 5) + (sum(mixing) * 3) + (sum(nutrients) * 1)
    penalty = 0
    if final_temp < 35 or final_temp > 39:
        penalty = 100
    Benefit = 100 / (abs(37 - final_temp) + 1)
    
    return Benefit - penalty - cost


#test based on 42 degree temp
if __name__ == "__main__":

    #create crom
    chrom = create_chromosome()
    #show gene
    print("Chromosome:", chrom)
    cooling, heating, mixing, nutrients = break_chromosome(chrom)
    print("Cooling %:", round(bits_to_percent(cooling) * 100), "%")
    print("Heating %:", round(bits_to_percent(heating) * 100), "%")
    print("Mixing %:", round(bits_to_percent(mixing) * 100), "%")
    print("Nutrients %:",    round(bits_to_percent(nutrients)    * 100), "%")
    #show score for fitness
    start_temp= 42
    new_temp = simulate_temperature(chrom, start_temp)
    score = calculate_fitness(chrom, new_temp)


    print(f"Start Temp: {start_temp}°C")
    print(f"Final Temp: {round(new_temp, 2)}°C")
    print(f"Fitness Score: {round(score, 2)}")