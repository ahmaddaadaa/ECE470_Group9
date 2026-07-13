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
    Benefit = 100 / (abs(37 - final_temp) + 1) #inverse fitness function scaled to 100
    
    return Benefit - penalty - cost

#perform a search of the the whole seach space to find the best chromsome

def exhastive_search(current_temp):
    best_chrom = None
    best_score = -9999

    # loops though whole search space each loop make a chromosome based on the numbers (i)
    

    for i in range(4096):
        chromosome = []
        for bit in format(i, '012b'):
            chromosome.append(int(bit))

        # caluclates the tmep and score for the curent choromosome
        final_temp = simulate_temperature(chromosome, current_temp)
        new_score = calculate_fitness(chromosome, final_temp)

        # finds the best score over all loops as only changes if the next score is larger than the previous socre
        if new_score > best_score:
            best_score = new_score
            best_chrom = chromosome
    
    return best_chrom, best_score



def hill_climbing(current_temp):
    #sets first chromosme 
    current_chrom = create_chromosome()
    final_temp = simulate_temperature(current_chrom, current_temp)
    current_score = calculate_fitness(current_chrom, final_temp)

    # take that chrom flipes on bit at a time (flips the 0th bit only, first bit only etc) if the next 
    # alteration had a greater score than the previous one new best neighbour.
    # end result the final best neighbour will be the flip that gives the highest score
    while True:
        best_neighbour = current_chrom
        best_neighbour_score = current_score
        for i in range(12):
            candidate = current_chrom.copy()
            candidate[i] = 1 - candidate[i]
            candidate_temp = simulate_temperature(candidate, current_temp)
            candidate_score = calculate_fitness(candidate, candidate_temp)
            if candidate_score > best_neighbour_score:
                best_neighbour_score = candidate_score
                best_neighbour = candidate


        # exit function: if at the end of the above for loop the all the flip dont improve the score we can leave as we are at "the top of the hill"
        #  < is there for the noise edge case 
        if best_neighbour_score <= current_score:
            return current_chrom, current_score
        


        # set the best neighbour from above fopr loop to the new current chromsome so it can be fliped one at a time to find a better score
        current_chrom = best_neighbour
        current_score = best_neighbour_score


#GA

# score every chromosomes in the population adds them to a list with there score repesnting there weights so GA can know which chormosmoes are good
def get_weights(population, current_temp):
    weights = []
    for chromosome in population:
        final_temp = simulate_temperature(chromosome, current_temp)
        score = calculate_fitness(chromosome, final_temp)
        weights.append(score)
    return weights


# due to fitness function some score can be negative take the lowest shiftes it up along with everything to remove negative
# then randomly chooses two parent with (higher weight mean more likely to be choosen)
def weighted_random_choices(population, weights):
    min_weight = min(weights)
    shifted = [w - min_weight + 1 for w in weights]  # +1 so worst still has a small chance

    parent1 = random.choices(population, weights=shifted, k=1)[0]
    parent2 = random.choices(population, weights=shifted, k=1)[0]
    return parent1, parent2


#randomly cuts both parent and creates a new child out of the front of parent one and back of parent 2
def crossover(parent1, parent2):
    split = random.randint(1, 11)              
    child = parent1[:split] + parent2[split:]  
    return child

# take the child and if mutate is called flips one of the bit in the chromosome randomly
def mutate(child):
    i = random.randint(0, 11)
    child[i] = 1 - child[i]
    return child

def genetic_algorithm(current_temp, population_size=20, generations=50, mutation_rate=0.1):
    # random population of size 20 for now
    population = []
    for _ in range(population_size):
        population.append(create_chromosome())


    # repeats for a number of generations get the weights (based on score) of the wcurrent loops population 
    for generation in range(generations):
        weights = get_weights(population, current_temp)   
        

        # bulk of the ga for the population size calls all of the helper fuction above 
        population2 = []
        for _ in range(population_size):
            # randomly selects 2 parent based on the weights
            parent1, parent2 = weighted_random_choices(population, weights)
            #perfomed the cross over
            child = crossover(parent1, parent2)
            #randopmly runs muation sometimes
            if random.random() < mutation_rate:
                child = mutate(child)
            population2.append(child)
        #make this the new population fo rthe next loop
        population = population2
    
    #after ga done return the best chromosome
    weights = get_weights(population, current_temp)
    best_index = weights.index(max(weights))
    best_chrom = population[best_index]
    return best_chrom, weights[best_index]

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
    exh_chrom, exh_score = exhastive_search(current_temp)
    exh_temp = simulate_temperature(exh_chrom, current_temp)
    print("Best exhastive search Chromosome:", exh_chrom)
    print("Best Final Temp:", round(exh_temp, 2), "°C")
    print("Best Fitness Score:", round(exh_score, 2))


    #hill climbing
    print("\nHill Climbing")
    hc_chrom, hc_score = hill_climbing(current_temp)
    hc_temp = simulate_temperature(hc_chrom, current_temp)
    print("Best hill climbing Chromosome:", hc_chrom)
    print("Best Final Temp:", round(hc_temp, 2), "°C")
    print("Best Fitness Score:", round(hc_score, 2))

    # genetic algorithm
    print("\nGenetic Algorithm")
    ga_chrom, ga_score = genetic_algorithm(current_temp)
    ga_temp = simulate_temperature(ga_chrom, current_temp)
    print("Best GA Chromosome:", ga_chrom)
    print("Best Final Temp:", round(ga_temp, 2), "°C")
    print("Best Fitness Score:", round(ga_score, 2))