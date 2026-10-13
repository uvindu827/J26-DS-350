"""Runtime check: all project libraries + PyTorch + plotting in ONE process (OpenMP conflict test)."""
import numpy as np
import pandas as pd
import xarray
import geopandas
import sklearn.ensemble
import xgboost
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# small PyTorch forward + backward pass
x = torch.randn(512, 28)
net = torch.nn.Sequential(torch.nn.Linear(28, 64), torch.nn.Tanh(), torch.nn.Linear(64, 3))
loss = net(x).pow(2).mean()
loss.backward()

# numpy + plotting after torch has run (the step that crashed before)
a = np.random.rand(500, 500) @ np.random.rand(500, 500)
plt.plot(np.arange(10), np.arange(10) ** 2)
plt.savefig("evidence/pp1/E14b_runtime_check.png")
plt.close()

print(f"torch {torch.__version__} | numpy {np.__version__} | xgboost {xgboost.__version__}")
print("Runtime check OK: no OpenMP conflict.")