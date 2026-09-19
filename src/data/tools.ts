export type ToolDefinition={slug:'compound'|'return'|'allocation';title:string;description:string;eyebrow:string;formula:string;assumptions:string[];example:string};
export const tools:ToolDefinition[]=[
 {slug:'compound',title:'복리 시나리오 계산기',description:'초기 투자금과 월 적립액, 기간, 기대수익률을 바꿔 총 납입액과 예상 평가액을 비교합니다.',eyebrow:'Long-term scenario',formula:'초기금액×(1+월수익률)^개월 + 매월 말 적립액의 미래가치 합계',assumptions:['연 수익률을 12로 나눈 일정한 월 수익률을 가정합니다.','월 적립은 매월 말에 이뤄지는 것으로 계산합니다.','세금·보수·거래비용과 수익률 변동 순서는 반영하지 않습니다.'],example:'기본값은 1,000만원을 시작으로 매월 50만원씩 10년간, 연 6%가 일정하다고 가정한 교육용 예시입니다.'},
 {slug:'return',title:'환율 포함 수익률 계산기',description:'매수가·매도가와 선택적 환율을 이용해 가격 효과와 환율 효과, 비용을 분리합니다.',eyebrow:'Return decomposition',formula:'순최종금액=(매도가×수량×매도환율)−총비용, 총수익률=순최종금액÷(매수가×수량×매수환율)−1',assumptions:['매수·매도 가격과 환율은 같은 통화 표기 기준이어야 합니다.','분배금·중간 현금흐름과 세금은 반영하지 않습니다.','가격 효과와 환율 효과의 단순 합은 총수익률과 다를 수 있습니다.'],example:'기본값은 100달러에 10주를 1,300원 환율로 사고 120달러·1,350원 환율에 평가하는 예시입니다.'},
 {slug:'allocation',title:'자산배분 점검기',description:'현재 보유금액과 목표 비중의 차이를 계산해 리밸런싱 기준 금액을 확인합니다.',eyebrow:'Allocation gap',formula:'목표금액=총자산×목표비중, 조정금액=목표금액−현재금액',assumptions:['목표 비중의 합은 100%여야 합니다.','매매비용·세금·최소 거래단위는 반영하지 않습니다.','현재 금액이 변하지 않는 한 한 시점의 정적 차이만 보여줍니다.'],example:'기본값은 총 1,000만원을 주식 50%·채권 30%·현금 20%로 맞추는 예시입니다.'}
];
export const getTool=(slug:string)=>tools.find(tool=>tool.slug===slug);
