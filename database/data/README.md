# SPPG Map Reference Data

`indonesia-city-centroids.json` contains 514 regency/city centroid coordinates
from [ArrayAccess/Indonesia-Postal-And-Area](https://github.com/ArrayAccess/Indonesia-Postal-And-Area),
based on BPS data. The source dataset is distributed under the MIT License;
copyright notice: Copyright (c) 2020 ArrayAccess.

These are administrative-area centroids, not verified SPPG kitchen locations.
The map uses them only when an SPPG record has no GPS coordinates, and labels
those markers as approximate. It first uses a regency/city centroid, then falls
back to the province centroid when a city match is unavailable. Records without
a safe city/province match are left unmapped instead of being assigned a guessed
point.
