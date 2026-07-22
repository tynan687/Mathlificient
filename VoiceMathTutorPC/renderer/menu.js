// Quick-action menu: fire an action, or open a small prompt for search terms.

// Size the window to the menu's real height so nothing clips.
function reportHeight() {
  const menu = document.querySelector('.menu');
  if (menu) window.tutor.send('menu:resize', menu.offsetHeight + 4);
}
window.addEventListener('load', reportHeight);

document.querySelectorAll('.item').forEach((el) => {
  el.addEventListener('click', () => {
    const prompt = el.getAttribute('data-prompt');
    if (prompt === 'web') {
      askThenSend('Search the web for:', 'engine:web-search');
    } else if (prompt === 'textbook') {
      askThenSend('Find in my textbooks:', 'engine:textbook-search');
    } else {
      window.tutor.send('menu:action', el.getAttribute('data-action'));
    }
  });
});

// Simple inline prompt so we don't need another window.
function askThenSend(label, channel) {
  const menu = document.querySelector('.menu');
  menu.innerHTML = `
    <div class="grp">${label}</div>
    <div style="padding:6px 10px">
      <input id="q" style="width:100%;box-sizing:border-box;padding:7px;border-radius:7px;
        border:1px solid #4a4f63;background:#1a1c26;color:#fff;font-size:13px" autofocus>
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
