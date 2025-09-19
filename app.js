/* app.js - ORDER_IT
   - Works across index.html, offers.html, order.html
   - Cart persists in localStorage
   - Checkout asks for name, phone, address and shows Order ID + details
*/

const MENU = [
  { id: 'm1', name: "Margherita Pizza", desc: "Classic cheese & tomato base", price: 299, cat: "mains", img: "images/pizza.jpeg"},
  { id: 'm2', name: "Paneer Biryani", desc: "Fragrant rice with soft paneer chunks", price: 349, cat: "mains", img: "images/panner_biriyani.jpeg" },
  { id: 'm3', name: "Samosa (2 pcs)", desc: "Crispy pastry filled with spiced potato", price: 69, cat: "starters", img: "images/samosa.jpeg" },
  { id: 'm4', name: "Paneer Tikka", desc: "Chargrilled paneer with masala", price: 199, cat: "starters", img: "images/panner_tikka.jpeg" },
  { id: 'm5', name: "Gulab Jamun (2)", desc: "Syrupy warm classic dessert", price: 99, cat: "desserts", img: "images/gulob_jamun.jpeg" },
  { id: 'm6', name: "Cold Coffee", desc: "Iced coffee with milk & sugar", price: 89, cat: "beverages", img: "images/cold_coffee.jpeg" },
  { id: 'm7', name: "Veggie Burger", desc: "Loaded with fresh veggies & sauces", price: 199, cat: "mains", img: "images/veg_burger.jpeg" }
];

const CART_KEY = 'orderit_cart';
const ORDERS_KEY = 'orderit_orders';
const PROMO_KEY = 'orderit_promo';

/* tiny utilities */
const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const loadJSON = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch(e){ return fallback; } };
const fmt = n => Number(n).toFixed(2);
const generateOrderId = () => {
  const ts = Date.now().toString().slice(-6);
  const rnd = Math.floor(100 + Math.random()*900);
  return `ORD${ts}${rnd}`;
};

/* cart helpers - stored as { id: qty } */
function getCart(){ return loadJSON(CART_KEY, {}); }
function saveCart(cart){ saveJSON(CART_KEY, cart); updateCartCounts(); }
function clearCart(){ saveCart({}); }

/* promo helpers */
function applyPromo(code){ saveJSON(PROMO_KEY, code); }
function getPromo(){ return localStorage.getItem(PROMO_KEY) || null; }
function clearPromo(){ localStorage.removeItem(PROMO_KEY); }

/* header counts update (works on all pages where spans exist) */
function updateCartCounts(){
  const cart = getCart();
  let total = 0;
  for (const k in cart) total += cart[k];
  ['cartCountHome','cartCountOffers','cartCountPage','cartCount'].forEach(id=>{
    const el = document.getElementById(id); if (el) el.textContent = total;
  });
}

/* ---------- Index page small setup ---------- */
if (document.getElementById('yearHome')) {
  document.getElementById('yearHome').textContent = new Date().getFullYear();
  // show a small featured preview if element exists
  const preview = document.getElementById('featuredPreview');
  if (preview) {
    const sample = MENU.slice(0,3);
    sample.forEach(it=>{
      const d = document.createElement('div');
      d.className = 'offer-card';
      d.innerHTML = `<img src="${it.img}" alt="${it.name}"><div class="offer-body"><h4>${it.name}</h4><p class="muted">${it.desc}</p></div>`;
      preview.appendChild(d);
    });
  }
  updateCartCounts();
}

/* ---------- Offers page behavior (apply promo) ---------- */
if (document.querySelectorAll('[data-apply-promo]').length) {
  const y = document.getElementById('yearOffers'); if (y) y.textContent = new Date().getFullYear();
  updateCartCounts();
  document.querySelectorAll('[data-apply-promo]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const code = btn.getAttribute('data-apply-promo');
      applyPromo(code);
      alert(`Promo "${code}" applied. Redirecting to Menu.`);
      window.location.href = 'order.html';
    });
  });
}

/* ---------- Order page: menu, cart rendering, checkout ---------- */
if (document.getElementById('menuGrid')) {
  const y = document.getElementById('yearPage'); if (y) y.textContent = new Date().getFullYear();
  updateCartCounts();

  // elements
  const menuGrid = document.getElementById('menuGrid');
  const searchInput = document.getElementById('searchInput');
  const categorySelect = document.getElementById('categorySelect');

  const cartToggle = document.getElementById('cartTogglePage');
  const cartSidebar = document.getElementById('cartSidebar');
  const closeCart = document.getElementById('closeCart');
  const cartItemsEl = document.getElementById('cartItems');

  const cartSubtotal = document.getElementById('cartSubtotal');
  const cartDiscount = document.getElementById('cartDiscount');
  const cartDelivery = document.getElementById('cartDelivery');
  const cartTax = document.getElementById('cartTax');
  const cartTotal = document.getElementById('cartTotal');

  const checkoutBtn = document.getElementById('checkoutBtn');
  const clearCartBtn = document.getElementById('clearCartBtn');

  const checkoutModal = document.getElementById('checkoutModal');
  const closeCheckoutModal = document.getElementById('closeCheckoutModal');
  const cancelCheckoutBtn = document.getElementById('cancelCheckoutBtn');
  const placeOrderBtn = document.getElementById('placeOrderBtn');

  const nameInput = document.getElementById('nameInput');
  const phoneInput = document.getElementById('phoneInput');
  const addressInput = document.getElementById('addressInput');

  const confirmModal = document.getElementById('confirmModal');
  const orderIdDisplay = document.getElementById('orderIdDisplay');
  const orderDetailsDisplay = document.getElementById('orderDetailsDisplay');
  const closeConfirmBtn = document.getElementById('closeConfirmBtn');

  // pricing helpers
  function calcDelivery(subtotal){ return subtotal >= 399 ? 0 : 40; }
  function calcTax(subtotal){ return subtotal * 0.05; }

  function calculateTotals(cartObj){
    let subtotal = 0;
    const items = [];
    for (const id in cartObj){
      const qty = cartObj[id];
      const meta = MENU.find(m => m.id === id);
      if (!meta) continue;
      items.push({...meta, qty});
      subtotal += meta.price * qty;
    }

    // promo logic
    const promo = getPromo();
    let discount = 0;
    if (promo === 'WELCOME20') discount = subtotal * 0.20;
    else if (promo === 'COMBO50' && subtotal >= 250) discount = 50;
    else if (promo === 'FREEDESSERT' && subtotal >= 499) discount = 50;

    const afterDiscount = Math.max(0, subtotal - discount);
    const delivery = calcDelivery(afterDiscount);
    const tax = calcTax(afterDiscount);
    const total = afterDiscount + delivery + tax;

    return { items, subtotal, discount, afterDiscount, delivery, tax, total };
  }

  // render menu
  function renderMenu(){
    const q = (searchInput.value || '').trim().toLowerCase();
    const cat = categorySelect.value || 'all';
    menuGrid.innerHTML = '';

    const filtered = MENU.filter(it=>{
      const matchCat = cat === 'all' || it.cat === cat;
      const matchQ = !q || it.name.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q);
      return matchCat && matchQ;
    });

    if (filtered.length === 0) {
      menuGrid.innerHTML = '<div class="muted">No items found</div>';
      return;
    }

    filtered.forEach(it=>{
      const el = document.createElement('div');
      el.className = 'menu-card';
      el.innerHTML = `
        <img src="${it.img}" alt="${escapeHtml(it.name)}">
        <div class="menu-body">
          <div>
            <div class="menu-title">${escapeHtml(it.name)}</div>
            <div class="menu-desc">${escapeHtml(it.desc)}</div>
          </div>
          <div class="menu-foot">
            <div style="font-weight:800">₹ ${it.price}</div>
            <div><button class="btn primary" data-add="${it.id}">Add</button></div>
          </div>
        </div>
      `;
      menuGrid.appendChild(el);
    });

    // add handlers
    document.querySelectorAll('[data-add]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const id = b.getAttribute('data-add');
        const cart = getCart();
        cart[id] = (cart[id] || 0) + 1;
        saveCart(cart);
        renderCart();
        openCart();
      });
    });
  }

  // render cart (sidebar)
  function renderCart(){
    const cart = getCart();
    const totals = calculateTotals(cart);
    cartItemsEl.innerHTML = '';

    if (totals.items.length === 0) {
      cartItemsEl.innerHTML = '<div class="muted">Your cart is empty</div>';
    } else {
      totals.items.forEach(it=>{
        const node = document.createElement('div');
        node.className = 'cart-item';
        node.innerHTML = `
          <img src="${it.img}" class="cart-thumb" alt="${escapeHtml(it.name)}">
          <div class="info">
            <div style="font-weight:700">${escapeHtml(it.name)}</div>
            <div class="muted" style="font-size:13px">₹ ${it.price} • ${it.qty} pcs</div>
          </div>
          <div>
            <div class="qty-controls">
              <button class="qty-btn" data-decr="${it.id}">−</button>
              <div style="min-width:28px;text-align:center">${it.qty}</div>
              <button class="qty-btn" data-incr="${it.id}">+</button>
            </div>
            <div style="margin-top:8px;text-align:right">
              <button class="btn ghost" data-del="${it.id}">Remove</button>
            </div>
          </div>
        `;
        cartItemsEl.appendChild(node);
      });
    }

    // totals UI
    cartSubtotal.textContent = fmt(totals.subtotal);
    cartDiscount.textContent = fmt(totals.discount);
    cartDelivery.textContent = fmt(totals.delivery);
    cartTax.textContent = fmt(totals.tax);
    cartTotal.textContent = fmt(totals.total);

    // qty and delete handlers
    Array.from(cartItemsEl.querySelectorAll('[data-incr]')).forEach(b=>{
      b.addEventListener('click', ()=> {
        const id = b.getAttribute('data-incr');
        const cart = getCart(); cart[id] = (cart[id]||0) + 1; saveCart(cart); renderCart(); updateCartCounts();
      });
    });
    Array.from(cartItemsEl.querySelectorAll('[data-decr]')).forEach(b=>{
      b.addEventListener('click', ()=> {
        const id = b.getAttribute('data-decr');
        const cart = getCart(); const next = (cart[id]||0) - 1;
        if (next <= 0) delete cart[id]; else cart[id] = next;
        saveCart(cart); renderCart(); updateCartCounts();
      });
    });
    Array.from(cartItemsEl.querySelectorAll('[data-del]')).forEach(b=>{
      b.addEventListener('click', ()=> {
        const id = b.getAttribute('data-del'); const cart = getCart(); delete cart[id]; saveCart(cart); renderCart(); updateCartCounts();
      });
    });

    updateCartCounts();
  }

  // open/close cart
  function openCart(){ cartSidebar.classList.add('open'); cartSidebar.setAttribute('aria-hidden','false'); }
  function closeCartF(){ cartSidebar.classList.remove('open'); cartSidebar.setAttribute('aria-hidden','true'); }

  // saveCart wrapper that re-renders
  function saveCart(cart){ saveJSON(CART_KEY, cart); renderCart(); updateCartCounts(); }

  // wire UI
  searchInput && searchInput.addEventListener('input', renderMenu);
  categorySelect && categorySelect.addEventListener('change', renderMenu);

  cartToggle && cartToggle.addEventListener('click', openCart);
  closeCart && closeCart.addEventListener('click', closeCartF);

  clearCartBtn && clearCartBtn.addEventListener('click', ()=> {
    if (confirm('Clear cart?')) { clearCart(); renderCart(); updateCartCounts(); }
  });

  checkoutBtn && checkoutBtn.addEventListener('click', ()=> {
    const cartObj = getCart();
    if (Object.keys(cartObj).length === 0) { alert('Cart is empty'); return; }
    checkoutModal.classList.add('open');
  });

  closeCheckoutModal && closeCheckoutModal.addEventListener('click', ()=> checkoutModal.classList.remove('open'));
  cancelCheckoutBtn && cancelCheckoutBtn.addEventListener('click', ()=> checkoutModal.classList.remove('open'));

  placeOrderBtn && placeOrderBtn.addEventListener('click', ()=>{
    const name = (nameInput.value || '').trim();
    const phone = (phoneInput.value || '').trim();
    const addr = (addressInput.value || '').trim();
    if (!name || !phone || !addr) { alert('Please enter name, phone and address'); return; }
    if (!/^\+?\d{7,15}$/.test(phone.replace(/\s+/g,''))) { alert('Please enter a valid phone number'); return; }

    const cartObj = getCart();
    const totals = calculateTotals(cartObj);

    const orderId = generateOrderId();
    const order = {
      orderId,
      items: totals.items.map(i=>({ id:i.id, name:i.name, price:i.price, qty:i.qty })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      delivery: totals.delivery,
      tax: totals.tax,
      total: totals.total,
      name, phone, address: addr,
      createdAt: new Date().toISOString(),
      status: 'Placed'
    };

    // save to orders
    const orders = loadJSON(ORDERS_KEY, []);
    orders.push(order); saveJSON(ORDERS_KEY, orders);

    // clear cart & promos
    clearCart(); clearPromo();
    renderCart(); updateCartCounts();

    // show confirmation
    orderIdDisplay.textContent = orderId;
    orderDetailsDisplay.innerHTML = `
      <p><strong>Subtotal:</strong> ₹ ${fmt(order.subtotal)}</p>
      <p><strong>Discount:</strong> − ₹ ${fmt(order.discount)}</p>
      <p><strong>Delivery:</strong> ₹ ${fmt(order.delivery)}</p>
      <p><strong>Tax:</strong> ₹ ${fmt(order.tax)}</p>
      <p><strong>Total:</strong> ₹ ${fmt(order.total)}</p>
      <p><strong>Name:</strong> ${escapeHtml(order.name)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(order.phone)}</p>
      <p><strong>Address:</strong> ${escapeHtml(order.address)}</p>
      <p><strong>Items:</strong></p>
      <ul style="text-align:left">${order.items.map(it=>`<li>${escapeHtml(it.name)} × ${it.qty} — ₹ ${fmt(it.price*it.qty)}</li>`).join('')}</ul>
    `;

    checkoutModal.classList.remove('open');
    confirmModal.classList.add('open');
  });

  closeConfirmBtn && closeConfirmBtn.addEventListener('click', ()=> confirmModal.classList.remove('open'));

  // initial render
  renderMenu();
  renderCart();
}

/* Generic header count update for all pages */
document.addEventListener('DOMContentLoaded', updateCartCounts);

/* helper functions used across file */
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
