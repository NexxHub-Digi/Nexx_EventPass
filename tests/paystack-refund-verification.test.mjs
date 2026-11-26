import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesProcessedRefund} from '../src/lib/paystack-refund-verification.ts';
const refund={id:123,transaction:456,domain:'test',currency:'NGN',amount:500000,status:'processed'};
test('full sandbox refund evidence must match all fields',()=>{
 assert.equal(matchesProcessedRefund(refund,'123','456',500000),true);
 for(const change of [{id:124},{transaction:457},{domain:'live'},{currency:'USD'},{amount:499999},{amount:'500000'},{status:'pending'},{status:'failed'}]){
  assert.equal(matchesProcessedRefund({...refund,...change},'123','456',500000),false);
 }
});
