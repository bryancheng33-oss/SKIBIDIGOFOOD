requireAuth();

  function contactLang(en) { return en; }
  function supportPriorityLabel(value) { return window.I18N && I18N.localizeSupportPriority ? I18N.localizeSupportPriority(value) : String(value || 'standard').replace(/-/g, ' '); }
  function accountTypeLabel(value) { const v = String(value || 'personal'); const labels = { personal: contactLang('Student'), corporate: contactLang('Campus Group') }; return labels[v] || v.replace(/-/g, ' '); }
  function contactEsc(value) {
    if (typeof sgfEscapeHtml === 'function') return sgfEscapeHtml(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function prefillContactForm() {
    const user = State.getUser() || {};
    const nameInput = document.getElementById('ct-name');
    const phoneInput = document.getElementById('ct-phone');
    const emailInput = document.getElementById('ct-email');
    if (nameInput && !nameInput.value.trim()) nameInput.value = user.name || '';
    if (phoneInput && !phoneInput.value.trim()) phoneInput.value = user.phone || '';
    if (emailInput && !emailInput.value.trim()) emailInput.value = user.email || '';
  }

  function sendMessage(e) {
    e.preventDefault();
    const name = document.getElementById('ct-name').value.trim();
    const phone = document.getElementById('ct-phone').value.trim();
    const email = document.getElementById('ct-email').value.trim();
    const msg = document.getElementById('ct-msg').value.trim();

    if (!name || !phone || !email || !msg) {
      State.notify(contactLang('⚠️ Please fill in all fields!'));
      return;
    }

    const created = State.addMessage({
      username: (State.getUser() || {}).username || '',
      name,
      phone,
      email,
      message: msg
    });

    ['ct-msg'].forEach((id) => { document.getElementById(id).value = ''; });
    const lane = supportPriorityLabel(created && created.supportPriority ? created.supportPriority : 'standard');
    State.notify(contactLang(`✅ Report submitted successfully! Report lane: ${lane}. Admin can now review it in the dashboard.`));
  }

  function renderSupportLane() {
    const note = document.getElementById('contact-support-note');
    if (!note) return;
    const lane = supportPriorityLabel(State.getSupportPriority ? State.getSupportPriority() : 'standard');
    const accountType = accountTypeLabel(State.getEffectiveAccountType ? State.getEffectiveAccountType() : 'personal');
    note.innerHTML = `<i class="fas fa-headset" aria-hidden="true"></i> ${contactEsc(contactLang('Current report lane'))}: <strong>${contactEsc(lane)}</strong> · ${contactEsc(contactLang('account type'))}: ${contactEsc(accountType)}.`;
  }

  function renderContactFaqs() {
    const wrap = document.getElementById('contact-faq-list');
    if (!wrap || !State.getFaqs) return;
    const faqs = State.getFaqs();
    const source = faqs;
    wrap.innerHTML = source.map((faq, idx) => `
      <details class="faq-item" ${idx===0?'open':''}>
        <summary>${contactEsc(faq.q)}</summary>
        <p>${contactEsc(faq.a)}</p>
      </details>`).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    prefillContactForm();
    renderSupportLane();
    renderContactFaqs();
  });
