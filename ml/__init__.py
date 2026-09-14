"""Cotton Grade machine-learning package.

Sub-packages
------------
- ``ml.data``       dataset discovery, splitting, preprocessing and augmentation
- ``ml.models``     architecture factory (timm backbones)
- ``ml.training``   training loop and metrics
- ``ml.inference``  predictors used by the API (mock + trained)
- ``ml.explain``    Grad-CAM
- ``ml.calibration`` temperature scaling
- ``ml.ood``        unknown / out-of-distribution rejection

Command-line entrypoints (``python -m ...``):
``ml.audit_dataset``, ``ml.split_dataset``, ``ml.train``, ``ml.evaluate``,
``ml.export_model``, ``ml.register_model``.
"""

__version__ = "0.1.0"
