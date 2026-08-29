import test from 'node:test';import assert from 'node:assert/strict';
function compound(initial,monthly,annualRate,years){const months=Math.round(years*12),r=annualRate/100/12;let value=initial;for(let i=0;i<months;i++)value=value*(1+r)+monthly;const contributed=initial+monthly*months;return{contributed,value,gain:value-contributed}}
function returns(buy,sell,q,buyFx=1,sellFx=1,fees=0){const invested=buy*q*buyFx,net=sell*q*sellFx-fees;return{invested,net,rate:(net/invested-1)*100}}
test('수익률 0이면 평가액은 납입액과 같다',()=>{const x=compound(100,10,0,1);assert.equal(x.value,220);assert.equal(x.gain,0)});test('환율과 비용을 반영한다',()=>{const x=returns(100,110,2,1300,1350,1000);assert.equal(x.invested,260000);assert.equal(x.net,296000);assert.ok(Math.abs(x.rate-13.846)<.01)});
