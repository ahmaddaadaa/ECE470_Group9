import random

# makes a random 12 bit binary list (our chromosome)
def create_chromosome():
    chromosome = []
    for _ in range(12):
        chromosome.append(random.randint(0, 1))
    return chromosome

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

# performs the fitness function we decided on benefit - penalty - cost

def calculate_fitness(chromosome, final_temp):
    cooling, heating, mixing, nutrients = break_chromosome(chromosome)

    cost = (sum(cooling) * 5) + (sum(heating) * 5) + (sum(mixing) * 3) + (sum(nutrients) * 1)
    penalty = 0
    if final_temp < 35 or final_temp > 39:
        penalty = 100
    Benefit = 100 / (abs(37 - final_temp) + 1)
    
    return Benefit - penalty - cost

#perform a search of the the whole seach space to find the best chromsome

def exhastive_search(current_temp):
    best_chrom = None
    best_score = -9999

    for i in range(4096):
        chromosome = []
        for bit in format(i, '012b'):
            chromosome.append(int(bit))
        final_temp = simulate_temperature(chromosome, current_temp)
        new_score = calculate_fitness(chromosome, final_temp)
        if new_score > best_score:
            best_score = new_score
            best_chrom = chromosome
    
    return best_chrom, best_score


#start of hill climbing just set up the starting point need to learn how to implement 

def hill_climbing(current_temp):
    current_chrom = create_chromosome()
    final_temp = simulate_temperature(current_chrom, current_temp)
    current_score = calculate_fitness(current_chrom, final_temp)




#test based on 42 degree temp
if __name__ == "__main__":


    print("\nsingle random chromosome")
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
    current_temp= 42
    final_temp = simulate_temperature(chrom, current_temp)
    score = calculate_fitness(chrom, final_temp)

    #score for single random chromosome
    print(f"Start Temp: {current_temp}°C")
    print(f"Final Temp: {round(final_temp, 2)}°C")
    print(f"Fitness Score: {round(score, 2)}")

    #exhastive search 
    print("\nExhaustive Search")
    best_chrom, best_score = exhastive_search(current_temp)
    best_final_temp = simulate_temperature(best_chrom, current_temp)
    print("Best Chromosome:", best_chrom)
    print("Best Final Temp:", round(best_final_temp, 2), "°C")
    print("Best Fitness Score:", round(best_score, 2))
