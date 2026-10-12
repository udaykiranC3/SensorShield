"""Train the Sensor Shield models on dataset.csv (temperature, humidity; no labels -> unsupervised).
Outputs model.json, which the dashboard embeds:
  * Isolation Forest anomaly score (+ percentile table used as 'risk')
  * mean / std baseline (the 'historical normal range' used in the SensorShield script)
Run: pip install pandas numpy scikit-learn && python train_model.py"""
import json, math, numpy as np, pandas as pd
from sklearn.ensemble import IsolationForest

df = pd.read_csv('dataset.csv')
X = df[['temperature', 'humidity']].values
mu, sd = X.mean(0), X.std(0)
Z = (X - mu) / sd
N_TREES, PS = 30, 32
iso = IsolationForest(n_estimators=N_TREES, max_samples=PS, random_state=42).fit(Z)

trees = []
for e in iso.estimators_:
    t = e.tree_
    trees.append([[int(t.feature[i]) if t.children_left[i] != -1 else -1,
                   round(float(t.threshold[i]), 4) if t.children_left[i] != -1 else 0,
                   int(t.children_left[i]), int(t.children_right[i]), int(t.n_node_samples[i])]
                  for i in range(t.node_count)])

def c(n): return 0 if n <= 1 else 1 if n == 2 else 2 * (math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n
def score(x):                      # same maths as the dashboard (JavaScript)
    s = 0
    for T in trees:
        i = d = 0
        while T[i][2] >= 0:
            i = T[i][2] if x[T[i][0]] <= T[i][1] else T[i][3]; d += 1
        s += d + c(T[i][4])
    return 2 ** (-(s / len(trees)) / c(PS))

sc = np.array([score(z) for z in Z])
skl = -iso.score_samples(Z)
print('max |python - sklearn| score diff:', float(np.abs(sc - skl).max()))
q = [round(float(v), 5) for v in np.percentile(sc, range(101))]
temps, hums = sorted(df.temperature.unique().tolist()), sorted(df.humidity.unique().tolist())
grid = [(t, h) for t in temps for h in hums]
assert len(grid) == len(df) and all(abs(a - b) < 1e-9 for r, g in zip(df.values.tolist(), grid) for a, b in zip(r, g)), 'not a full grid'
ds = dict(n=len(df), T=temps, H=hums, tm=round(float(df.temperature.mean()), 3), ts=round(float(df.temperature.std()), 3),
          hm=round(float(df.humidity.mean()), 3), hs=round(float(df.humidity.std()), 3),
          tmin=float(df.temperature.min()), tmax=float(df.temperature.max()), hmin=float(df.humidity.min()), hmax=float(df.humidity.max()))
json.dump(dict(m=[round(float(v), 5) for v in mu], s=[round(float(v), 5) for v in sd], ps=PS, T=trees, q=q, ds=ds),
          open('model.json', 'w'), separators=(',', ':'))
tests = [[40, 35], [78.7, 55], [104, 55], [121, 80], [60, 70], [28, 55]]
json.dump([[a, b, score([(a - mu[0]) / sd[0], (b - mu[1]) / sd[1]])] for a, b in tests], open('/tmp/exp.json', 'w'))
print('trees', N_TREES, 'nodes', sum(len(t) for t in trees), 'temps', len(temps), 'hums', len(hums))
print('score quantiles p0/50/95/100:', q[0], q[50], q[95], q[100])
