#!/bin/sh

./build.sh

if [ $? -ne 0 ]; then
  echo ">> Error building contract"
  exit 1
fi

echo ">> Deploying contract"

# https://docs.near.org/tools/near-cli#near-dev-deploy
near dev-deploy --wasmFile build/obra_publica.wasm
#--initFunction new --initArgs '{"titular": "martinbronzino.testnet", "costo_participacion": "2000000000000000000000"}'