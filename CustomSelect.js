((g, f) => { 
  g.cSelect = f(); 
})(window, () => {
  const isSmartPhone = () => /Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent);

  function setup(el) {
    const getAttr = (root) => {
      const Attr = root?.dataset.attr?.replace(/'/g, '"');
      if (Attr) {
        try { return JSON.parse(`{ ${Attr} }`); } 
        catch(e) { console.error(e); return {}; }
      }
      return {};
    }

    const root = el;
    let setting = getAttr(root);

    const optionBox = root.querySelector('.option');
    const labels = [...optionBox.querySelectorAll('label')];

    // ==== UI Elements ====
    const dis = document.createElement('div');
    dis.className = 'select-dis';

    const val = document.createElement('span');
    val.className = 'select-value';
    val.textContent = setting?.placeholder && typeof setting.placeholder !== 'boolean' ? setting.placeholder : 'Please select';

    const arrow = document.createElement('span');
    arrow.className = 'select-arrow';
    arrow.textContent = '▼';

    dis.appendChild(val);
    dis.appendChild(arrow);
    root.insertBefore(dis, optionBox);

    // placeholder label
    const placeholder = document.createElement('label');
    placeholder.dataset.placeholder = true;
    placeholder.textContent = setting?.placeholder && typeof setting.placeholder !== 'boolean' ? setting.placeholder : 'Please select';
    optionBox.insertBefore(placeholder, optionBox.firstChild);
    if (setting?.placeholder === false) placeholder.remove();

    const allOptions = [...optionBox.querySelectorAll('label')];
    let index = -1;

    // ==== Search ====
    const useSearch = (setting?.search !== false && (typeof setting?.search === 'boolean' || setting?.search === '')) 
                      || (setting?.search === 'auto' && labels.length >= (setting.autoNum || 5));
    let searchInput;
    if (useSearch) {
      searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'select-search NoBorder';
      searchInput.placeholder = 'Search...';
      optionBox.prepend(searchInput);

      searchInput.addEventListener('input', () => {
        const keyword = searchInput.value.toLowerCase();
        processLabelsAsync(labels, keyword);
      });
    }

    // ==== Levenshtein distance ====
    function levenshtein(a, b) {
      const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
      for (let i = 0; i <= a.length; i++) dp[i][0] = i;
      for (let j = 0; j <= b.length; j++) dp[0][j] = j;
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1];
          else dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+1);
        }
      }
      return dp[a.length][b.length];
    }

    function processLabelsAsync(labels, keyword) {
      const chunkSize = 50;
      let i = 0;
      function processChunk() {
        const end = Math.min(i + chunkSize, labels.length);
        for (; i < end; i++) {
          const label = labels[i];
          const origTxt = label.textContent;
          const text = origTxt.toLowerCase();
          if (!keyword) {
            label.style.display = '';
            label.innerHTML = origTxt;
            continue;
          }
          if (text.includes(keyword)) {
            label.style.display = '';
            label.innerHTML = origTxt.replace(new RegExp(`(${keyword})`, 'gi'), '<mark>$1</mark>');
            continue;
          }
          const distance = levenshtein(text, keyword);
          const threshold = Math.max(1, Math.ceil(keyword.length * 0.2));
          if (distance <= threshold) {
            label.style.display = '';
            label.innerHTML = origTxt;
          } else label.style.display = 'none';
        }
        if (i < labels.length) setTimeout(processChunk, 0);
      }
      processChunk();
    }

    // ==== Open/Close ====
    function open() {
      setting = getAttr(root);
      if (setting?.disabled) return;
      document.querySelectorAll('.select').forEach(el => el.classList.remove('open'))
      root.classList.add('open')
  
      const rect = root.getBoundingClientRect()
      const optionHeight = optionBox.scrollHeight || 200
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
  
      if (spaceBelow < optionHeight && spaceAbove > spaceBelow) {
        optionBox.style.top = 'auto'
        optionBox.style.bottom = 'calc(100% + 5px)'
      } else {
        optionBox.style.top = 'calc(100% + 5px)'
        optionBox.style.bottom = 'auto'
      }
      if (!isSmartPhone()) searchInput?.focus();
    }
    function close() { root.classList.remove('open'); }

    // ==== Choose ====
    function choose(i) {
      setting = getAttr(root);
      if (setting?.disabled) return;
      index = i;
      allOptions.forEach(o => o.classList.remove('active'));
      allOptions[i].classList.add('active');
      val.textContent = allOptions[i].textContent;

      if (useSearch && searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
      }

      close();

      const emit = setting?.emitMode === 'window' ? window : root;
      emit.dispatchEvent(new CustomEvent('selectChanged', {
        detail: { root, value: allOptions[i].textContent, index: i }
      }));
    }

    // ==== Events ====
    dis.addEventListener('click', () => root.classList.contains('open') ? close() : open());
    allOptions.forEach((opt, i) => opt.addEventListener('click', e => { choose(i); e.stopPropagation(); }));
    root.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { if (!root.classList.contains('open')) open(); else if (index >= 0) choose(index); e.preventDefault(); }
      if (e.key === 'ArrowDown') { if (!root.classList.contains('open')) open(); index = (index+1)%allOptions.length; highlight(index); e.preventDefault(); }
      if (e.key === 'ArrowUp') { if (!root.classList.contains('open')) open(); index = (index-1+allOptions.length)%allOptions.length; highlight(index); e.preventDefault(); }
      if (e.key === 'Escape') close();
    });
    function highlight(i) { allOptions.forEach(o => o.classList.remove('active')); allOptions[i].classList.add('active');allOptions[i].scrollIntoView({behavior: "smooth",block: "nearest"});}

    // ==== Initial value ====
    if (typeof setting?.initial === 'number') { labels[setting.initial]?.click(); }
    if (setting?.for) root.querySelector(`#${setting.for}`)?.click();
  }

  // ==== Update ====
  function update(el) {
    const root = el;
    const optionBox = root.querySelector('.option');
    const val = root.querySelector('.select-value');
    if (!optionBox || !val) return;

    const Attr = root?.dataset.attr?.replace(/'/g, '"');
    let setting = {};
    if (Attr) {
      try { setting = JSON.parse(`{ ${Attr} }`); } 
      catch(e) { console.error(e); }
    }

    // placeholder 更新
    const placeholder = optionBox.querySelector('label[data-placeholder]');
    if (placeholder) placeholder.textContent = setting?.placeholder && typeof setting.placeholder !== 'boolean' ? setting.placeholder : 'Please select';
    if (val.textContent === '' || val.textContent === placeholder.textContent) val.textContent = placeholder.textContent;

    // options があれば追加（既存ラベルは残す）
    if (setting.options && Array.isArray(setting.options)) {
      const existing = [...optionBox.querySelectorAll('label')].map(l => l.textContent);
      setting.options.forEach(opt => {
        if (!existing.includes(opt)) {
          const label = document.createElement('label');
          label.textContent = opt;
          optionBox.appendChild(label);

          label.addEventListener('click', () => {
            val.textContent = opt;
            root.dispatchEvent(new CustomEvent('selectChanged', {detail:{root,value:opt}}));
          });
        }
      });
    }

    // 選択中の値を維持
    const activeLabel = [...optionBox.querySelectorAll('label')].find(l => l.textContent === val.textContent);
    optionBox.querySelectorAll('label').forEach(l => l.classList.remove('active'));
    if (activeLabel) activeLabel.classList.add('active');
  }

  // ==== Outer click to close all selects ====
  document.addEventListener('click', e => {
    if (!e.target.closest('.select')) document.querySelectorAll('.select.open').forEach(sel => sel.classList.remove('open'));
  });

  return { setup, update };
});
