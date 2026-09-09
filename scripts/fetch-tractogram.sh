#!/usr/bin/env sh
# Refresh public/assets/tracts/hcp1065.trx with the HCP1065 streamlines used by
# visualneuroscience.ai/tracts (6.2 MB). Run once on a machine with internet,
# then commit public/assets/tracts/hcp1065.trx.
set -e
cd "$(dirname "$0")/.."
mkdir -p public/assets/tracts
curl -fL --progress-bar -o public/assets/tracts/hcp1065.trx "https://visualneuroscience.ai/assets/tracts/hcp1065.trx"
ls -la public/assets/tracts/hcp1065.trx
echo "done — rebuild not needed; the home page loads this file directly."
