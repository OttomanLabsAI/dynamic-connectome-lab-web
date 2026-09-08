// Publications search: filters the visible list by keyword; the tabs are CSS-only.
(function () {
  var input = document.getElementById('pub-search');
  var body = document.getElementById('pub-body');
  var count = document.getElementById('pub-count');
  if (!input || !body) return;
  var items = Array.prototype.slice.call(body.querySelectorAll('.pubs li'));
  var radios = Array.prototype.slice.call(document.querySelectorAll('.pub-radio'));
  function activePanel() {
    var r = radios.filter(function (x) { return x.checked; })[0];
    return r ? body.querySelector('[data-panel="' + r.id.replace('tab-', '') + '"]') : null;
  }
  function apply() {
    var q = input.value.trim().toLowerCase();
    var terms = q ? q.split(/\s+/) : [];
    var shown = 0, panel = activePanel();
    items.forEach(function (li) {
      var t = li.textContent.toLowerCase();
      var ok = terms.every(function (w) { return t.indexOf(w) > -1; });
      li.hidden = !ok;
      if (ok && panel && panel.contains(li)) shown++;
    });
    body.querySelectorAll('.year-group').forEach(function (g) {
      g.style.display = g.querySelector('li:not([hidden])') ? '' : 'none';
    });
    body.classList.toggle('is-empty', shown === 0);
    var total = panel ? panel.querySelectorAll('li').length : items.length;
    count.textContent = q ? shown + ' of ' + total + ' shown' : total + ' entries';
  }
  input.addEventListener('input', apply);
  radios.forEach(function (r) { r.addEventListener('change', apply); });
  apply();
})();
