// Keep keyboard navigation in the active custom dialog, then return it to its opener.
export const modalFocus={
 mounted(el){
  const opener=document.activeElement;
  const available=()=>[...el.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(x=>x.getClientRects().length);
  const handle=event=>{if(event.key!=='Tab')return;const items=available(),first=items[0],last=items.at(-1);if(!first){event.preventDefault();el.focus();return;}if(event.shiftKey&&(document.activeElement===first||!el.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!el.contains(document.activeElement))){event.preventDefault();first.focus();}};
  el.tabIndex=-1;el.addEventListener('keydown',handle);queueMicrotask(()=>{if(el.isConnected)(available()[0]||el).focus();});
  el.__familyFocusCleanup=()=>{el.removeEventListener('keydown',handle);if(opener?.isConnected)opener.focus();};
 },beforeUnmount(el){el.__familyFocusCleanup?.();}
};
