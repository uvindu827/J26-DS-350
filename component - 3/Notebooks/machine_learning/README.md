# Machine-learning notebooks

Run these notebooks in order after `../07_modelling_eda_and_split.ipynb`:

1. `08a_ml_baselines.ipynb`
2. `08b_ridge_regression.ipynb`
3. `08c_random_forest.ipynb`
4. `08d_extra_trees.ipynb`
5. `08e_hist_gradient_boosting.ipynb`
6. `08f_xgboost.ipynb`
7. `08g_catboost.ipynb`
8. `08h_ml_model_comparison.ipynb`

Every experiment uses the same frozen chronological partitions, predictor roles,
expanding-window folds and evaluation metrics. The 2024 test partition remains
sealed throughout this directory. Model-specific artifacts are written below
`models/` and `outputs/{audit,metrics,predictions,figures}/model_training/`.

