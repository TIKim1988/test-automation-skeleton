import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./automation/browser-contracts', workers:1, retries:0, reporter:'list', use:{headless:true}, outputDir:'test-results/overlay-contracts'});
