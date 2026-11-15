/** Three physical kits per mission checkpoint. A lost deployed relay is never recovered. */
export function createStores(capacity=3,cycle=1){if(!Number.isInteger(capacity)||capacity<1||capacity>20)throw RangeError('Invalid stores');return {capacity,issued:0,cycle};}
export const remaining=s=>s.capacity-s.issued;
export function issueRelay(s){if(remaining(s)<=0)throw Error('No spare relay kits remain. Restore the assembly checkpoint.');return {...s,issued:s.issued+1};}
export function restoreStores(s){return createStores(s.capacity,s.cycle+1);}
export function canResupply(s,phase){return remaining(s)>0&&['contact','report','planning'].includes(phase);}
