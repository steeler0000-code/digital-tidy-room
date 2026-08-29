export type ToolDefinition={slug:'compound'|'return'|'allocation';title:string;description:string;eyebrow:string};
export const tools:ToolDefinition[]=[
 {slug:'compound',title:'복리 시나리오 계산기',description:'초기 투자금과 월 적립액, 기간, 기대수익률을 바꿔 총 납입액과 예상 평가액을 비교합니다.',eyebrow:'Long-term scenario'},
 {slug:'return',title:'환율 포함 수익률 계산기',description:'매수가·매도가와 선택적 환율을 이용해 가격 효과와 환율 효과, 비용을 분리합니다.',eyebrow:'Return decomposition'},
 {slug:'allocation',title:'자산배분 점검기',description:'현재 보유금액과 목표 비중의 차이를 계산해 리밸런싱 기준 금액을 확인합니다.',eyebrow:'Allocation gap'}
];
export const getTool=(slug:string)=>tools.find(tool=>tool.slug===slug);
