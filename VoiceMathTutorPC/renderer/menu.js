// Quick-action menu: fire an action, or open a small prompt for search terms.
//
// The items come from nav.js, which the home screen also renders — two hardcoded
// copies of the same list had no way of staying in step.

function buildMenu() {
  const menu = document.querySelector('.menu');
  menu.innerHTML = '';
  for (const group of NAV_GROUPS) {
    if (menu.children.length) menu.appendChild(Object.assign(document.createElement('div'), { className: 'sep' }));
    const heading = document.createElement('div');
    heading.className = 'grp';
    heading.textContent = group.name;
    menu.appendChild(heading);
    for (const item of group.items) {
      const row = document.createElement('div');
      row.className = 'item';
      if (item.action) row.dataset.action = item.action;
      if (item.prompt) row.dataset.prompt = item.prompt;
      const ico = document.createElement('span');
      ico.className = 'ico';
      ico.textContent = item.icon;
      row.appendChild(ico);
      row.appendChild(document.createTextNode(item.label));
      row.addEventListener('click', () => {
        if (item.prompt) {
          const p = NAV_PROMPTS[item.prompt];
          askThenSend(p.label, p.channel);
        } else {
          window.tutor.send('menu:action', item.action);
        }
      });
      menu.appendChild(row);
    }
  }
}
buildMenu();

// Size the window to the menu's real height so nothing clips.
function reportHeight() {
  const menu = document.querySelector('.menu');
  if (menu) window.tutor.send('menu:resize', menu.offsetHeight + 4);
}
window.addEventListener('load', reportHeight);

// Simple inline prompt so we don't need another window.
function askThenSend(label, channel) {
  const menu = document.querySelector('.menu');
  menu.innerHTML = `
    <div class="grp">${label}</div>
    <div style="padding:6px 10px">
      <input id="q" style="width:100%;box-sizing:border-box;padding:7px;border-radius:7px;
        border:1px solid var(--line-strong);background:var(--bg);color:var(--fg);font-size:13px" autofocus>
    </div>
    <div class="item" id="go"><span class="ico">↵</span>Search</div>`;
  const input = document.getElementById('q');
  input.focus();
  const fire = () => {
    const value = input.value.trim();
    if (value) window.tutor.send(channel, value);
    window.tutor.send('menu:close');
  };
  document.getElementById('go').addEventListener('click', fire);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fire();
    if (e.key === 'Escape') window.tutor.send('menu:close');
  });
}
