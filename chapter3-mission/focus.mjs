// Keep keyboard focus within the current projected console; Tab does not open
// the host PDA while a chapter dialog owns input.
export function cycleFocus(root,event){
 event.preventDefault();event.stopImmediatePropagation();
 const controls=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),summary,a[href]')].filter(el=>el.getClientRects().length);
 if(!controls.length)return;
 const index=controls.indexOf(document.activeElement),next=(index+(event.shiftKey?-1:1)+controls.length)%controls.length;
 controls[next].focus({preventScroll:true});
}
