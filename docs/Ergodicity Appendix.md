
There is a widespread but erroneous belief that randomness averages out over time.  

Randomness is an unavoidable part of how most things change over time. How much your food supply changes, how a company’s revenue and expenses change, or how your self-esteem changes over time, typically has a random component. There are two different kinds of randomness: either the changes do average out over time, i.e., keep going long enough and the randomness averages out (named ergodic randomness); or they do not average out over time (called non-ergodic randomness). Economics, portfolio theory, and business theory assumes that randomness averages.  

But almost everything in life, including our economy, has the non-ergodic type of randomness that does not average out. Instead of trending to the average almost all random processes in life, and certainly in our economy, trend below average. Which probably sounds wrong to you, because we’re taught that the average is the most likely outcome! But that is only true for the very rare case of ergodic randomness.  

Whenever you have compound growth, bankruptcy, or resource constraints, you have non-ergodic randomness. And for these three types of non-ergodic randomness the most likely outcome is  strictly below average. This systemic over-estimation in the economy we call the ergodicity error, caused by the myth that all randomness is ergodic.

Since we're talking about a mathematical categorisation of two different classes of randomness, here's the strict mathematics we use in the paper. 

For some time dependent variable $x(t)$ (for example, the amount of some capital) that can have some value out of a set of all possible values for $x$. This set of all possible values is called the ensemble. Then the expected value, a.k.a. the average, or ensemble average $\langle x \rangle$ of $x$ is the arithmetic average over the ensemble. 
$$
        \langle x  \rangle  = \frac{1}{N}\sum_{i=1}^{N} x_i
$$
for an ensemble containing $N$ possible values for $x$. For continuous  $x(t)$ replace the sum with an integral over all  $x(t)$.

There is a second way of calculating the average if you’re looking at the sequence of  $x(t)$ over some length of time. This time average is obtained by taking the average across time from the start $t=0$  to the end $T$.
$$
        \bar{x}_T = \frac{1}{T}\sum_{t=1}^{T} x(t)
$$
where each of the $x(t)$ are taken from the same ensemble with $N$ possible values for $x(t)$.

If, and only if, the two are equal when ${T \to \infty}$ 
$$
        \langle x  \rangle  = \bar{x}_{T \to \infty}
$$
do you have ergodic randomness. If they are not equal you have non-ergodic randomness. 

Since the randomness is driven by the specific dynamics of the change process (e.g. cell division in biology, or compound interest in finance) we also call it ergodic or non-ergodic dynamics. 

We then define the degree of non-ergodicity over some relevant characteristic duration  $T=\tau$ as: 
$$
\tilde{E}^{\circ^2}(\tau) = \frac{\langle ( \overline{x}_\tau - \langle x \rangle )^2 \rangle}{\langle x \rangle^2}
$$
because nothing in our economy lasts for mathematically infinite time. What is more relevant is the outcome over some characteristic duration $\tau$. This might be the lifetime of a fund (e.g. 10 years), a human generation (e.g. 20-30 years), or the typical duration of a civilisation (e.g. 300-400 years).

Then, for a practical implementation in a simulation of a circular economy, or in analysing historical data, we propose using the median of the available data over the characteristic time $\tau$: $\overline{x}_{\tau m}$ and the sample average at time $\tau$: $\langle x_{\tau s} \rangle$ yielding 
$$
\tilde{E}^{\circ^2}(\tau) = \frac{\langle ( \overline{x}_{\tau m} - \langle x_{\tau s} \rangle )^2 \rangle}{\langle x_{\tau s} \rangle^2}
$$

In this paper we propose that $\tilde{E}^{\circ}(\tau)$ is at least one element of $\beta$ in the paper of Goerner et al. In other words we define 
$$
\beta = f(\tilde{E}^{\circ^2}(\tau))
$$
and then $F$ in the paper of Goerner et al. becomes a function of the characteristic time we are looking at, $\alpha$, and $\beta$:
$$
F(\tau, \alpha, \beta) = -e \cdot \alpha^\beta ln (\alpha^\beta)
$$
then $F_\text{max} = 1$ at $\alpha = e^{-1/\beta}$ 

Then as  $\tilde{E}^{\circ}(\tau) \to 0$ $F_\text{max}(\alpha)$ occurs at $\alpha = 0$, and as  $\tilde{E}^{\circ}(\tau) \to \infty$ $F_\text{max}(\alpha)$ occurs at $\alpha = 1$.  

The comes the question of what it is that can change ergodically or non-ergodically. Building on the work of Goerner et al. and subsequent papers we define 
$$
M_{ij}(t)
$$
as the money flowing from node $i$ to node $j$ with some time dependency indicated by $t$. Note that $t$ may be composed of multiple time variables, but for simplicity we will represent them all by $t$. 

Note also that to avoid confusion with time, in this paper we use $M_{ij}$ instead of the $T_{ij}$ used by Goerner et al. or the $F_{ij}$ used by Fath et al. in their appendix.

Then the total system throughput is 
$$
M_{..}(t) = \sum_{i,j} M_{ij}(t)
$$
And the capacity for system development is defined as 
$$
C(t) = -\sum_{i,j} M_{ij}(t) \ln \bigg(\frac{M_{ij}(t)}{M_{..}(t)}\bigg)
$$
The directed power to maintain the current system integrity, in other words to deliver a rigid but maximally efficient system, called the Ascendency, is then 
$$
A(t) = \sum_{i,j} M_{ij}(t) \ln \bigg(\frac{M_{ij}(t)M_{..}(t)}{M_{i.}(t)M_{.j}(t)}\bigg)
$$
And the Reserve capacity for flexible actions to deal with unpredictables, to deal with black and white swans, to deal with non-ergodic dynamics, is 
$$
\Phi(t) = \sum_{i}\sum_{j} (M_{ij}(t)) \ln \bigg(\frac{M^2_{ij}(t)}{\sum_j M_{ij}(t)\sum_i M_{ij}(t)}\bigg)
$$
You then have 
$$
C(t) = A(t) + \Phi(t)
$$
with $\alpha$ defined in this paper as 
$$
\alpha(t) = \frac{\Phi(t)}{C(t)}
$$
which places maximum efficiency, zero redundancy at $\alpha = 0$, and maximum redundancy minimum efficiency at $\alpha=1$. In some of the papers referenced the $\alpha$ is defined the other way around, as $\alpha(t) = A(t)/C(t)$



Some additional references for our thinking
- https://www.johndcook.com/blog/2014/11/22/ergodic/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC4343082/#:~:text=Ergodicity%20was%20first%20introduced%20by,%E2%80%9CErgodicity%20was%20loosely%20defined.https://pmc.ncbi.nlm.nih.gov/articles/PMC11254532/
- https://math.stackexchange.com/questions/272580/where-does-ergodic-come-from#:~:text=Ludwig%20Boltzmann%20(1844%2D1906),Doob's%20Stochastic%20Processes%20(1954).

And 
- Aleksander Jakimowicz [The Role of Entropy in the Development of Economics](https://www.researchgate.net/publication/340699220_The_Role_of_Entropy_in_the_Development_of_Economics)  https://www.mdpi.com/1099-4300/22/4/452 
	- - **Non-ergodicity & Ill-behaved Problems:** Because complex economic systems (often treated in ecological economics) are non-ergodic—the average behavior of the system does not equal the time average of a single unit—standard econometric models fail. These failing, ill-posed, or unstable inverse problems are described as "ill-behaved".
	- **Role of Entropy Economics:** Entropy economics, particularly leveraging Tsallis entropy (non-extensive), provides a superior method for estimating models under these non-ergodic conditions compared to traditional, ergodicity-assuming methods.
	- **Solution Approach:** The study proposes that **[non-extensive cross-entropy econometrics (NCEE)](https://www.google.com/search?client=ubuntu-sn&channel=fs&q=non-extensive+cross-entropy+econometrics+%28NCEE%29&mstk=AUtExfBvWGzSqaEBKWEwCwjwcWaklIqv0QOvQu0J1H55P-KNzsc80beabmlRfSlUmp3iE85VZt8aBbwCka1PXHRtJCHnEGGiKf9g4LuL3Db6xj6YBkhympch6mhbWqZ-2J_GT7oDL8XQ1f2Fe3F_5kut0FuzLP3M3soK9dmZXXLUqO3XP3s&csui=3&ved=2ahUKEwjzndvczIGUAxXmhf0HHcbNFjoQgK4QegQIAxAD)** enables modeling of these systems, making it a critical tool for complex system analysis in the face of uncertainty and high-system entropy. 
	- This perspective emphasizes a move toward, or the need to acknowledge, complexity and nonlinearity in economic modelling over the classical, ergodic, and equilibrium-driven assumptions.
	- Last two para quotes Gell-Mann developing a key aspect of **Complex Adaptive Systems**:  Therefore, it is best to adopt the definition of the effective complexity of an entity proposed by Gell-Mann. It should be understood as the length of a concise schema showing the regularity of this entity, which has been drawn up by the observer – the chosen complex adaptive system. The concept under consideration is, therefore, inherently and inextricably linked with the cognitive agent, and disregarding this relationship will always be a source of misunderstanding. In the greatest discovery of complexity economics, it was proved that some markets and economies have the ability to tune in to the edge of chaos. A necessary, but not sufficient, condition is that they are complex adaptive systems. The edge of chaos is the distinguished state of a system situated between periodic and chaotic behaviour, where it has the maximum computing power. Around the edge of chaos, the complexity of the system is close to optimal and its adaptability is the greatest [128,129]. The edge of chaos may have one of the following forms: chaotic attractors and repellers, catastrophes of complexity, coexistence of attractors, sensitive dependence on parameters, final state sensitivity, effects of fractal basin boundaries, chaotic saddles [130]
- **Zisopoulos et al. (2025)** Circular Economy Rejects the "machine" (ergodic) metaphor for a regenerative, non-ergodic organic model.
- Meder, D., Rabe, F., Morville, T., Madsen, K. H., Koudahl, M. T., Dolan, R. J., Siebner, H. R., & Hulme, O. J. (2021). Ergodicity-breaking reveals time optimal decision making in humans. _PLOS Computational Biology_, _17_(9), e1009217. [https://doi.org/10.1371/journal.pcbi.1009217](https://doi.org/10.1371/journal.pcbi.1009217)  (See below) 

# Gemini on this

have any papers , books, blogs or articles been published on the application of ergodicity and non-ergodicity in the field of circular economies? Especially those referring to non-ergodic dynamics by the word ergodic, instead of synonyms?

The study of **ergodicity** and **non-ergodicity** in the **circular economy (CE)** is a burgeoning intersection of thermodynamics, complexity economics, and sustainability science. While mainstream economics frequently relies on the **"Ergodic Hypothesis"**—the assumption that the average of a process over time is the same as the average across all possible states at a single time—ecological and heterodox economists argue that the circular economy is fundamentally **non-ergodic** due to the irreversible nature of entropy and path-dependency (Jakimowicz, 2020; Peters, 2019).

### **Key Scientific Works and Frameworks**

#### **1. The Thermodynamic Foundation (Georgescu-Roegen)**

The most influential precursor to this field is **Nicholas Georgescu-Roegen’s** 1971 book, _The Entropy Law and the Economic Process_. Although he did not always use the modern "ergodic economics" vocabulary, his work established that economic processes are **irreversible and non-ergodic** (Jakimowicz, 2020).

- **The Claim:** A perfect "circular" economy is impossible because entropy ensures that material and energy quality degrade with every cycle.
    
- **Term Usage:** In this context, a "circular flow" that ignores entropy is essentially an **ergodic model** of a system that is physically **non-ergodic**.
    

#### **2. Ergodicity Economics (Ole Peters and the LML)**

The **London Mathematical Laboratory (LML)**, led by **Ole Peters**, has pioneered "Ergodicity Economics." While their primary focus is often finance, their critiques of the "pernicious error" of assuming ergodicity in growth models are increasingly applied to sustainability (Peters, 2019).

- **Application:** If wealth and resources are non-ergodic, "expected value" (the ensemble average) is a poor metric for circularity. Instead, one must look at the **time average** of resource growth and depletion (Meder et al., 2021).
    
- **Blog/Article:** Peters' blog, _Ergodicity Economics_, and his 2019 _Nature Physics_ paper are foundational for anyone applying these dynamics to systemic resource flows.
    

#### **3. Ecological Metaphors and Non-Ergodic Dynamics**

Recent research in _Ecological Economics_ has begun to explicitly label regenerative circular systems as non-ergodic (Zisopoulos et al., 2025).

- **Concept:** These papers argue against the "machine metaphor" of the circular economy (which is ergodic/stable) and for an "organic metaphor" where the system is **emergent, adaptive, and non-ergodic** (Zisopoulos et al., 2025).

# Gemini on Taleb using Ergodic

Now tell me when Nassim Taleb first used the word ergodic.

Nassim Nicholas Taleb’s relationship with the word "ergodic" is unique because he spent decades writing about the **concept** of ergodicity—using terms like "ruin," "absorbing barriers," and "path dependence"—before he began using the specific word as a central pillar of his philosophy.

While he was a mathematical trader in the 1980s and 1990s and would have been technically familiar with the term from stochastic calculus, its appearance in his "Incerto" series follows a specific timeline:

### **1. Conceptual Pre-History (1997–2007)**

In his first two major books, the word "ergodic" is conspicuously absent from the primary text, even though the books are entirely about non-ergodic systems.

- **Dynamic Hedging (1997):** As a technical manual for quants, he discusses **"absorbing barriers"** (the mathematical cause of non-ergodicity in finance), but the term "ergodic" was not yet his preferred branding.
    
- **Fooled by Randomness (2001):** He uses the **Russian Roulette** example to illustrate why "ensemble averages" (what happens to 6 people) differ from "time averages" (what happens to 1 person over 6 rounds). He describes this as **path dependence**, but does not use the word "ergodic."
    
- **The Black Swan (2007):** He focuses on **Extremistan** (fat tails) and the **Ludic Fallacy**. Again, he describes the _mechanisms_ of non-ergodicity without the label.
    

### **2. The Turning Point (2011–2014)**

Taleb credits his interaction with **Ole Peters** (the physicist who founded the "Ergodicity Economics" movement) around 2011/2012 for the formal adoption of the term. Taleb realized that "ergodicity" was the precise mathematical name for the "survival" and "ruin" problems he had been writing about for 30 years.

### **3. First Significant Use of the Label (2014–2015)**

The word "ergodic" first becomes a "headline" term in his work through his technical papers and online notebooks:

- **Technical Papers (2014):** In his paper **_"The Logic of Risk Taking"_** (which later became a core chapter of _Skin in the Game_), he explicitly names and defines ergodicity as the bridge between collective and individual risk.
    
- **Silent Risk (2015):** In his technical notes (later published as _Statistical Consequences of Fat Tails_), ergodicity is treated as a formal requirement for statistical inference.
    

### **4. Mainstream Integration (2018)**

- **Skin in the Game (2018):** This is the first of his popular books where "ergodicity" is a primary, titled concept. In **Chapter 19: The Logic of Risk Taking**, he provides a definitive guide to the "Ergodicity Problem," explicitly stating that the failure to distinguish between ensemble and time averages is the most significant error in modern economics.
    

---

### **Summary of "Firsts"**

|**Event**|**Year**|**Context**|
|---|---|---|
|**First Conceptual Use**|1997 / 2001|Discussed via "absorbing barriers" and "Russian Roulette" in _Fooled by Randomness_.|
|**First Technical Paper**|2014|_The Logic of Risk Taking_ explicitly defines the ergodicity problem.|
|**First Popular Book**|2018|_Skin in the Game_ introduces "ergodicity" as a household name for his followers.|

> **Note on "Synonyms":** Taleb often notes that "Ruin" is the most practical synonym for non-ergodicity in a human context. If a system has a "stop" (ruin), the time-average will inevitably hit zero, even if the ensemble average looks positive.

Would you like to know more about how Taleb's specific definition of "ruin" differs from the traditional mathematical definition of ergodicity used in physics?


# Journal of Ecological Economics
The **Transdisciplinary** Journal of the [International Society for Ecological Economics (ISEE)](http://www.isecoeco.org/)

The journal is concerned with extending and integrating the understanding of the interfaces and interplay between "nature's household" (**ecosystems**) and "humanity's household" (**the economy**). Ecological economics is an interdisciplinary field defined by a set of concrete problems or challenges related to governing economic activity in a way that promotes human well-being, sustainability, and justice. The journal thus emphasizes critical work that draws on and integrates elements of ecological science, economics, and the analysis of values, behaviors, cultural practices, institutional structures, and societal dynamics. The journal is transdisciplinary in spirit and methodologically open, drawing on the insights offered by a variety of intellectual traditions, and appealing to a diverse readership.



# Social Sciences - Molenaar
Can you suggest research papers introducing the concept of ergodicity into the social sciences? I'm especially looking for one from the early 2000s I think around 2006 pointing out that most social science research looks at a large base size at one point in time, and then uses that data to predict the development of one person over time. Which only works if it's ergodic. But often it's not ergodic.

The research you are describing is almost certainly the work of **Peter C. M. Molenaar**, specifically his "classic manifesto" from 2004 and his influential follow-up in 2007 (Chow et al., 2024).
- https://www.researchgate.net/publication/247504791_A_Manifesto_on_Psychology_as_Idiographic_Science_Bringing_the_Person_Back_Into_Scientific_Psychology_This_Time_Forever
- 

Molenaar is credited with introducing the formal **Ergodic Theorem** to psychology and the social sciences to point out a fundamental flaw in how research is conducted: the assumption that variations found between people (cross-sectional) are the same as variations within a single person over time (longitudinal) (Beltz et al., 2016; von Oertzen et al., 2020).

### **The Key Research Papers**

#### **1. The "Manifesto" (2004)**

**Molenaar, P. C. M. (2004).** _A manifesto on psychology as idiographic science: Bringing the person back into scientific psychology, this time forever._ * **The Core Argument:** This paper argues that most psychological processes are **non-ergodic** (Beltz et al., 2016).

- **The Critique:** Molenaar points out that the "Nomothetic" approach—which looks at a large group of people at one point in time to establish general laws—cannot be used to predict the behavior or development of a **single individual** unless the process is ergodic (Beltz et al., 2016; Chow et al., 2024).
    

#### **2. The Developmental Critique (2007)**

**Molenaar, P. C. M. (2007).** _On the implications of the classical ergodic theorems for analysis of developmental processes._ * **Why it matches your search:** This paper, published around the 2006 timeframe you recalled, specifically tackles the **"large base size"** problem. It proves mathematically that for a developmental process to be ergodic, two conditions must be met: 1. **Stationarity:** The statistical properties (mean, variance) must stay constant over time (von Oertzen et al., 2020; Investigating the evolution of the self in psychotherapy..., 2026). 2. **Homogeneity:** Every individual in the population must follow the exact same dynamic laws (Investigating the evolution of the self in psychotherapy..., 2026).

- **The Conclusion:** Since humans are self-organizing and change over time, they are almost always non-ergodic (Investigating the evolution of the self in psychotherapy..., 2026).

### More details: 

The papers you are looking for were written by **Peter C. M. Molenaar**, who is the primary figure responsible for bringing ergodic theory into the spotlight of modern social science and psychology.

Here are the specific URLs and reference details for the papers you described:

### 1. The "Manifesto" (2004)

This is the foundational paper where he argues that psychology has lost "the person" by focusing on population averages.

- **Title:** _A Manifesto on Psychology as Idiographic Science: Bringing the Person Back Into Scientific Psychology, This Time Forever_
    
- **Journal:** Measurement: Interdisciplinary Research and Perspectives
    
- **DOI:** [10.1207/s15366359mea0204_1](https://doi.org/10.1207/s15366359mea0204_1)
    
- **Direct URL (Taylor & Francis):** [tandfonline.com/doi/abs/10.1207/s15366359mea0204_1](https://www.tandfonline.com/doi/abs/10.1207/s15366359mea0204_1)
    
- **Full Text (ResearchGate):** [View on ResearchGate](https://www.researchgate.net/publication/247504791_A_Manifesto_on_Psychology_as_Idiographic_Science_Bringing_the_Person_Back_Into_Scientific_Psychology_This_Time_Forever)
    

### 2. The Developmental Critique (2007/2008)

This is the more mathematically rigorous follow-up that explicitly tackles the "large base size" (inter-individual variation) vs. "individual development" (intra-individual variation) problem.

- **Title:** _On the implications of the classical ergodic theorems: Analysis of developmental processes has to focus on intra-individual variation_
    
- **Journal:** Developmental Psychobiology
    
- **DOI:** [10.1002/dev.20262](https://doi.org/10.1002/dev.20262)
    
- **Direct URL (Wiley Online Library):** [onlinelibrary.wiley.com/doi/abs/10.1002/dev.20262](https://onlinelibrary.wiley.com/doi/abs/10.1002/dev.20262)
    
- **Abstract/Summary (PubMed):** [pubmed.ncbi.nlm.nih.gov/18085558/](https://pubmed.ncbi.nlm.nih.gov/18085558/)
    

### **Why these papers are significant to your query:**

In these works, Molenaar highlights what is now sometimes called the **"Ergodic Fallacy"** or the **"Ergodic Switch."**

He demonstrates that:

- **Inter-individual variation** (studying many people at one time) only yields information about **intra-individual variation** (one person over time) if the system is **stationary** (doesn't change over time) and **homogeneous** (everyone in the group is identical in their dynamics).
    
- Since humans learn, age, and adapt, they are by definition **non-stationary**.
    
- Since individuals have unique histories and biological makeups, they are **heterogeneous**.
    

Therefore, applying "average" results from a group study to predict the future state of a specific individual is, as Molenaar puts it, a "fundamental error" of logic.

If you are interested in how this has evolved into broader public consciousness, you might also look at **Todd Rose’s** 2016 book **_The End of Average_**, which popularizes Molenaar's findings for a general audience.

---

### **The Ergodicity Problem in Social Science**

The "Ergodic Theorem" establishes the conditions under which a **time average** (one person over many points in time) equals the **ensemble average** (many people at one point in time) (von Oertzen et al., 2020).

When social scientists ignore this, they commit what Molenaar calls a "fundamental error":

- **The Nomothetic Fallacy:** If you study 1,000 people today to see how "stress affects performance," you are looking at an **ensemble average**.
    
- **The Individual Failure:** If you use that data to tell **one specific person** how they will perform next week, you are assuming ergodicity. If that person’s stress response is unique or changes as they age, the population-level data is mathematically irrelevant to them (Beltz et al., 2016).
    

### **Related Modern Developments**

Since Molenaar’s early 2000s work, the field has expanded into new methods for handling this non-ergodicity:

- **Ergodic Subspace Analysis (ESA):** A newer method used to identify which parts of a dataset are actually ergodic and which are person-specific (von Oertzen et al., 2020).
    
- **GIMME (Group Iterative Multiple Model Estimation):** A technique developed to bridge the gap by identifying patterns that are shared across a group while still allowing for individual-level "non-ergodic" variations (Beltz et al., 2016).
    

### **References**

Beltz, A. M., Wright, A. G. C., Sprague, B. N., & Molenaar, P. C. M. (2016). Bridging the Nomothetic and Idiographic Approaches to the Analysis of Clinical Data. _Assessment_, _23_(4), 447–458. [https://doi.org/10.1177/1073191116648209](https://doi.org/10.1177/1073191116648209) Cited by: 385

Chow, S.-M., Hamaker, E. L., & Ram, N. (2024). From Behavioral Genetics to Idiographic Science: Methodological Developments and Applications Inspired by the Work of Peter C. M. Molenaar. _Multivariate Behavioral Research_, _59_(6), 1107–1110. [https://doi.org/10.1080/00273171.2024.2394054](https://doi.org/10.1080/00273171.2024.2394054) Cited by: 2

Investigating the evolution of the self in psychotherapy with a mixed-method approach: A pilot study. (2026). _Psychotherapy Research_. [https://doi.org/10.1080/10503307.2026.2642111](https://www.google.com/search?q=https://doi.org/10.1080/10503307.2026.2642111)

von Oertzen, T., Schmiedek, F., & Voelkle, M. C. (2020). Ergodic Subspace Analysis. _Journal of Intelligence_, _8_(1), 3. [https://doi.org/10.3390/jintelligence8010003](https://www.google.com/search?q=https://doi.org/10.3390/jintelligence8010003) Cited by: 6

Does the distinction between "nomothetic" (population-level) and "idiographic" (individual-level) research match the specific paper you were looking for?