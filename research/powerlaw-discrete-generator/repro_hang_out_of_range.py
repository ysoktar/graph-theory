"""
powerlaw 2.0.0: generate_random() hangs (infinite loop) for a discrete power law whose exponent lies
outside the default parameter range (alpha in [0, 3]). Run with a timeout:

    timeout 20 python repro_hang_out_of_range.py ; echo "exit code $?"     # 124 = killed by timeout
"""
import warnings
import powerlaw

warnings.filterwarnings("ignore")
d = powerlaw.Power_Law(xmin=1, parameters=[3.5], discrete=True)
print("in_range():", d.in_range(), "  ccdf(2), ccdf(100):", d.ccdf(data=[2]), d.ccdf(data=[100]), " (should be 0.112 and 3.6e-6)")
print("continuous version works:", powerlaw.Power_Law(xmin=1, parameters=[3.5], discrete=False).generate_random(3))
print("discrete version with parameter_ranges={'alpha': [1, 10]}:",
      powerlaw.Power_Law(xmin=1, parameters=[3.5], discrete=True, parameter_ranges={"alpha": [1, 10]}).generate_random(5))
print("discrete version with the default range (this call never returns):", flush=True)
print(d.generate_random(5))
