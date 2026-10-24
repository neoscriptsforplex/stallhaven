export async function enter(pg){
  await pg.goto(`http://localhost:${process.env.PORT || 5299}/stallhaven/`,{waitUntil:'load'}); await pg.waitForTimeout(3000);
  await pg.getByText(/(Click|Tap) to play/).click({timeout:20000}).catch(()=>{});
  await pg.locator('[data-slot-new="1"]').click({timeout:20000}).catch(e=>console.log('new',e.message));
  await pg.locator('[data-slot-start="1"]').click({timeout:20000}).catch(e=>console.log('start',e.message));
  await pg.waitForTimeout(6000);
}
export async function clean(pg){ await pg.evaluate(()=>{ document.getElementById('help-modal').hidden = true; document.querySelectorAll('.modal').forEach(m=>m.hidden=true); }); await pg.waitForTimeout(300); }
