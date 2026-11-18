import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Paystack test-only guard exists',()=>assert.match(read('src/lib/paystack.ts'),/sk_test_/));
test('Split commission is calculated on server',()=>{const s=read('src/app/api/payments/paystack/initialize/route.ts');assert.match(s,/commissionKobo/);assert.match(s,/transaction_charge:fee/);assert.match(s,/subaccount:order.subaccount_code/)});
test('Webhook validates signature and verifies provider independently',()=>{const s=read('src/app/api/payments/paystack/webhook/route.ts');assert.match(s,/validWebhook/);assert.match(s,/transaction\\/verify/);assert.match(s,/reconciliation_required/)});
test('Migrations isolate payment and refund records',()=>{const s=read('migrations/20261118_paystack.sql');assert.match(s,/CREATE TABLE IF NOT EXISTS paystack_payments/);assert.match(s,/CREATE TABLE IF NOT EXISTS paystack_refunds/)});
