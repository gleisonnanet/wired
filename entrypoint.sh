#!/bin/bash
cp -p docker/.env app/apps/client/.env
yarn  install --no-lockfile
yarn run dev
