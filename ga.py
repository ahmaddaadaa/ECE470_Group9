import random
import matplotlib.pyplot as plt

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
        + random.gauss(0, 0.05)  # noise
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

def exhaustive_search(current_temp):
    best_chrom = None
    best_score = -9999
    evaluations = 0

    # loops though whole search space each loop make a chromosome based on the numbers (i)
    

    for i in range(4096):
        chromosome = []
        for bit in format(i, '012b'):
            chromosome.append(int(bit))

        # caluclates the tmep and score for the curent choromosome
        final_temp = simulate_temperature(chromosome, current_temp)
        new_score = calculate_fitness(chromosome, final_temp)
        evaluations += 1

        # finds the best score over all loops as only changes if the next score is larger than the previous socre
        if new_score > best_score:
            best_score = new_score
            best_chrom = chromosome
    
    return best_chrom, best_score, evaluations



def hill_climbing(current_temp):
    #sets first chromosme 
    current_chrom = create_chromosome()
    final_temp = simulate_temperature(current_chrom, current_temp)
    current_score = calculate_fitness(current_chrom, final_temp)
    evaluations = 1 

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
            evaluations += 1 
            if candidate_score > best_neighbour_score:
                best_neighbour_score = candidate_score
                best_neighbour = candidate


        # exit function: if at the end of the above for loop the all the flip dont improve the score we can leave as we are at "the top of the hill"
        #  < is there for the noise edge case 
        if best_neighbour_score <= current_score:
            return current_chrom, current_score, evaluations
        


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


# grab k random chromosomes and return the best one
# good chromosomes win their tournaments so they're picked more often
def tournament_select(population, weights, k=3):
    best_index = random.randrange(len(population))
    for _ in range(k - 1):
        i = random.randrange(len(population))
        if weights[i] > weights[best_index]:
            best_index = i
    return population[best_index]

# randomly cuts both parent twice creates a new child out of the front and back of parent one and middle of parent 2
def crossover(parent1, parent2):
    p1 = random.randint(1, 10)
    p2 = random.randint(p1 + 1, 11)
    child = parent1[:p1] + parent2[p1:p2] + parent1[p2:]
    return child

# take the child and if mutate is called flips one of the bit in the chromosome randomly
def mutate(child):
    i = random.randint(0, 11)
    child[i] = 1 - child[i]
    return child

def genetic_algorithm(current_temp, population_size=20, generations=50, mutation_rate=0.1, elite_count=3):
    # random population of size 20 for now
    population = []
    for _ in range(population_size):
        population.append(create_chromosome())

    evaluations = 0
    history = []


    # repeats for a number of generations get the weights (based on score) of the wcurrent loops population 
    for generation in range(generations):
        weights = get_weights(population, current_temp)   
        evaluations += len(population)
        #history.append(max(weights))
        current_best = max(weights)
        if not history:
            history.append(current_best)
        else:
            history.append(max(current_best, history[-1]))

        
        #elitism take some of the best chromosome from the previous population into the new population before modifiying them
        #zips each chromosomes in the population with there corisponign weights then organises those weight chromosome so the best weighted chromsome is at the front
        ranked = sorted(zip(weights, population), key=lambda pair: pair[0], reverse=True)
        population2 = []
        #takes the top (elite_count) number of chromsome with the highest weight and adds them to that population 2
        for e in range(elite_count):
            population2.append(ranked[e][1])   # add the top chromosome(s) first


        #fills the new pop with children 
        while len(population2) < population_size:
            
            # tournament selection picks each parent
            parent1 = tournament_select(population, weights)
            parent2 = tournament_select(population, weights)
            # perfomed the cross over
            child = crossover(parent1, parent2)
            #randopmly runs muation sometimes
            if random.random() < mutation_rate:
                child = mutate(child)
            #adds all the children in the loop into pop2
            population2.append(child)
        #make this the new population (pop2) into population for the next loop
        population = population2
    
    #after ga done return the best chromosome
    weights = get_weights(population, current_temp)
    evaluations += len(population)

    best_index = weights.index(max(weights))
    best_chrom = population[best_index]
    return best_chrom, weights[best_index], evaluations, history

def benchmark_exhaustive(current_temp, runs=30):
    exh_scores = []
    exh_evals = []

    #loops though set amount of runs
    for _ in range(runs):
        chrom, score, evaluations = exhaustive_search(current_temp)
        exh_scores.append(score)
        exh_evals.append(evaluations)  

    #averages all run together
    avg_score = sum(exh_scores) / len(exh_scores)
    avg_evals = sum(exh_evals) / len(exh_evals)
    return avg_score, avg_evals

#hc benchmark 30 runs
def benchmark_HC(current_temp, runs=30):
    hc_scores = []
    hc_evals = []

    #loops though set amount of runs
    for _ in range(runs):
        chrom, score, evaluations = hill_climbing(current_temp)
        hc_scores.append(score)
        hc_evals.append(evaluations)  

    #averages all run together
    avg_score = sum(hc_scores) / len(hc_scores)
    avg_evals = sum(hc_evals) / len(hc_evals)
    return avg_score, avg_evals

#ga benchmark 30 runs

def benchmark_ga(current_temp, runs=30):
    scores = []
    evals = [] 

    #loops though set about of runs
    for _ in range(runs):
        chrom, score, evaluations, history = genetic_algorithm(current_temp)
        scores.append(score)
        evals.append(evaluations)       

    #averages all run together
    avg_score = sum(scores) / len(scores)
    avg_evals = sum(evals) / len(evals)
    return avg_score, avg_evals







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
    exh_chrom, exh_score, exh_eval = exhaustive_search(current_temp)
    exh_temp = simulate_temperature(exh_chrom, current_temp)
    print("Best exhastive search Chromosome:", exh_chrom)
    print("Best Final Temp:", round(exh_temp, 2), "°C")
    print("Best Fitness Score:", round(exh_score, 2))
    print("total # of evaluations:", (exh_eval))


    #hill climbing
    print("\nHill Climbing")
    hc_chrom, hc_score, hc_eval = hill_climbing(current_temp)
    hc_temp = simulate_temperature(hc_chrom, current_temp)
    print("Best hill climbing Chromosome:", hc_chrom)
    print("Best Final Temp:", round(hc_temp, 2), "°C")
    print("Best Fitness Score:", round(hc_score, 2))
    print("total # evaluations:", (hc_eval))

    # genetic algorithm
    print("\nGenetic Algorithm")
    ga_chrom, ga_score, ga_eval, ga_hist = genetic_algorithm(current_temp)
    ga_temp = simulate_temperature(ga_chrom, current_temp)
    print("Best GA Chromosome:", ga_chrom)
    print("Best Final Temp:", round(ga_temp, 2), "°C")
    print("Best Fitness Score:", round(ga_score, 2))
    print("total # evaluations:", (ga_eval))

    # benchmarking 
    print("\nBenchmarks (averaged over 30 runs)")

    exh_avg_score, exh_avg_evals = benchmark_exhaustive(current_temp)
    hc_avg_score, hc_avg_evals = benchmark_HC(current_temp)
    ga_avg_score, ga_avg_evals = benchmark_ga(current_temp)

    print(f"Exhaustive: avg score {round(exh_avg_score, 2)}, avg evals {round(exh_avg_evals)}")
    print(f"Hill Climb: avg score {round(hc_avg_score, 2)}, avg evals {round(hc_avg_evals)}")
    print(f"GA:         avg score {round(ga_avg_score, 2)}, avg evals {round(ga_avg_evals)}")

    # distance from optimum found by exhastive search
    hc_percent = (hc_avg_score / exh_avg_score) * 100
    ga_percent = (ga_avg_score / exh_avg_score) * 100
    print(f"\nHill Climb reached {round(hc_percent, 1)}% of the optimum (exhaustive search)")
    print(f"GA reached {round(ga_percent, 1)}% of the optimum (exhaustive search)")


    #bar charts
    plt.figure()


    # how close each method got to the global optimum as a percent (averaged over 30 runs)
    methods = ["Exhaustive", "Hill Climbing", "GA"]
    scores = [100, hc_percent, ga_percent]
    bars = plt.bar(methods, scores, color=["gray", "orange", "green"])

    # add the number on top of each bar
    for bar in bars:
        height = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2, height + 1,
                 f"{round(height, 1)}%", ha="center")

    plt.ylabel("Percent of Optimum (%)")
    plt.title("Percent of Optimum: Exhaustive vs Hill Climbing vs GA")
    plt.savefig("benchmark_chart.png")
          

    plt.figure()

    # average number of fitness evaluations per run (over 30 runs)
    methods = ["Exhaustive", "Hill Climbing", "GA"]
    evals = [exh_avg_evals, hc_avg_evals, ga_avg_evals]

    eval_bars = plt.bar(methods, evals, color=["gray", "orange", "green"])

    for bar in eval_bars:
        height = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2, height + 1,
                 f"{round(height, 1)}", ha="center")

    plt.ylabel("Average Evaluations")
    plt.title("Evaluations (Cost): Exhaustive vs Hill Climbing vs GA")
    plt.savefig("evaluations_chart.png")

    plt.figure()


    #single run best score shown so far fo reach genertaion (done to show impovment )
    
    plt.plot(ga_hist, color="green", marker="o")
    plt.xlabel("Generation")
    plt.ylabel("Best Fitness Score")
    plt.title("GA Convergence: Best Score Over Generations")
    plt.savefig("convergence_chart.png")


    plt.show()   

                
