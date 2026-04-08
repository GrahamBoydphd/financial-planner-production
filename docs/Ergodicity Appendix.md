
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

There is a second way of calculating the average if you’re looking at the sequence of  $x(t)$ over some length of time. This time average is obtained by taking taking the average across time $\tau$ from the start $t=0$  to the end $t=\tau$.
$$
        \bar{x}_\tau = \frac{1}{\tau}\sum_{t=1}^{\tau} x(t)
$$
where each of the $x(t)$ are taken from the same ensemble with $N$ possible values for $x(t)$.

If, and only if, when ${\tau \to \infty}$ the two are equal
$$
        \langle x  \rangle  = \bar{x}_{\tau \to \infty}
$$
do you have ergodic randomness. If they are not equal you have non-ergodic randomness. 

Since the randomness is driven by the specific dynamics of the change process (e.g. cell division in biology, or compound interest in finance) we also call it ergodic or non-ergodic dynamics. 

We then define the degree of non-ergodicity over some characteristic duration $\tau$ as: 
$$
\tilde{E}^{\circ^2}(\tau) = \frac{\langle ( \overline{x}_\tau - \langle x \rangle )^2 \rangle}{\langle x \rangle^2}
$$
We restrict ourselves to the case of typical dynamics in our economy (geometric growth with absorbing boundaries) where $\overline{x}_\tau < \langle x \rangle$ and 
$$
\lim_{\tau \to \infty}\tilde{E}^{\circ}(\tau) \to \infty
$$

But, of course, nothing in our economy lasts for mathematically infinite time! What is more relevant is the outcome over some characteristic duration $\tau$. This might be the lifetime of a fund (e.g. 10 years), a human generation (e.g. 20-30 years), or the typical duration of a civilisation (e.g. 300-400 years).

Then, for a practical implementation in a simulation of a circular economy, or in analysing historical data, we propose using the median of the available data over time $\tau$: $\overline{x}_{\tau m}$ and the sample average at time $T$: $\langle x_{\tau s} \rangle$ yielding 
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

Note also that to avoid confusion with time, in this paper we use $M_{ij}$ instead of the $T_{ij}$ used by Goerner et al. or the $F_{ij} used by Fath et al. in their appendix.

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


