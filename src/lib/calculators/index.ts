export function compoundScenario(initial:number,monthly:number,annualRate:number,years:number){
 const months=Math.round(years*12);const r=annualRate/100/12;let value=initial;for(let i=0;i<months;i++)value=value*(1+r)+monthly;const contributed=initial+monthly*months;return{contributed,value,gain:value-contributed};
}
export function investmentReturn(buy:number,sell:number,quantity:number,buyFx=1,sellFx=1,fees=0){
 const invested=buy*quantity*buyFx;const gross=sell*quantity*sellFx;const net=gross-fees;const priceOnly=(sell/buy-1)*100;const fxOnly=(sellFx/buyFx-1)*100;return{invested,net,gain:net-invested,rate:(net/invested-1)*100,priceOnly,fxOnly};
}
export function allocationGap(rows:{name:string;amount:number;target:number}[]){
 const total=rows.reduce((sum,row)=>sum+row.amount,0);return{total,rows:rows.map(row=>({ ...row,current:total?row.amount/total*100:0,targetAmount:total*row.target/100,difference:total*row.target/100-row.amount}))};
}
