const MOCK_PRODUCTS = [
  {name:'Stoneground Bread Flour',category:'Flours & Premixes',size:'1kg',price:185,image:'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=80',stock:'Available'},
  {name:'Callebaut Dark Callets',category:'Chocolate & Cocoa',size:'1kg',price:720,image:'https://images.unsplash.com/photo-1575377222312-55f8f016f25c?auto=format&fit=crop&w=700&q=80',stock:'Available'},
  {name:'Almond Cream Cheese',category:'Dairy & Fats',size:'250g',price:230,image:'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=700&q=80',stock:'Running Low'},
  {name:'Dutch Process Cocoa',category:'Chocolate & Cocoa',size:'500g',price:310,image:'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=80',stock:'Available'},
  {name:'Vanilla Bean Paste',category:'Flours & Premixes',size:'118ml',price:495,image:'https://images.unsplash.com/photo-1614707267537-2b8a1f7a3c9b?auto=format&fit=crop&w=700&q=80',stock:'Running Low'},
  {name:'Gold Cake Boards',category:'Decorations & Packaging',size:'10 pieces',price:160,image:'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=80',stock:'Available'},
  {name:'European Style Butter',category:'Dairy & Fats',size:'500g',price:290,image:'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=700&q=80',stock:'Out of Stock'},
  {name:'Scalloped Tart Pan',category:'Tools & Molds',size:'9 inch',price:385,image:'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=700&q=80',stock:'Available'},
  {name:'Rainbow Confetti Sprinkles',category:'Decorations & Packaging',size:'100g',price:145,image:'https://images.unsplash.com/photo-1588195538326-c5b1e5b80f5d?auto=format&fit=crop&w=700&q=80',stock:'Available'},
  {name:'Silicone Spatula Set',category:'Tools & Molds',size:'3 pieces',price:260,image:'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=700&q=80',stock:'Available'}
];
let products = MOCK_PRODUCTS;
let selectedCategory = 'All Items';
const grid = document.querySelector('#product-grid');
const emptyState = document.querySelector('#empty-state');
const resultCount = document.querySelector('#result-count');
const searchInput = document.querySelector('#search');
const availableOnly = document.querySelector('#available-only');
function peso(value){return `₱${value.toLocaleString('en-PH')}`}
function render(){
  const query = searchInput.value.trim().toLowerCase();
  const visible = products.filter(product => {
    const matchesCategory = selectedCategory === 'All Items' || product.category === selectedCategory;
    const matchesSearch = !query || `${product.name} ${product.category}`.toLowerCase().includes(query);
    const matchesStock = !availableOnly.checked || product.stock !== 'Out of Stock';
    return matchesCategory && matchesSearch && matchesStock;
  });
  grid.innerHTML = visible.map(product => `<article class="product-card"><div class="product-image" style="background-image:url('${product.image}')"><span class="stock-badge ${product.stock === 'Running Low' ? 'low' : product.stock === 'Out of Stock' ? 'out' : ''}">${product.stock}</span></div><div class="product-info"><div class="product-category">${product.category}</div><h3 class="product-name">${product.name}</h3><div class="product-meta"><span class="product-size">${product.size}</span><strong class="product-price">${peso(product.price)}</strong></div></div></article>`).join('');
  emptyState.hidden = visible.length > 0;
  resultCount.textContent = visible.length ? `${visible.length} ${visible.length === 1 ? 'item' : 'items'} in view` : 'No items in view';
}
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {selectedCategory = button.dataset.category;document.querySelector('.filter.active').classList.remove('active');button.classList.add('active');render()}));
searchInput.addEventListener('input', render);availableOnly.addEventListener('change', render);
async function loadProducts(){
  const url = window.BAKE_ALLEY_SUPABASE_URL;
  const key = window.BAKE_ALLEY_SUPABASE_ANON_KEY;
  if (!url || !key || !window.supabase) return;
  const client = window.supabase.createClient(url, key);
  const {data, error} = await client.from('products').select('*').order('name');
  if (!error && data?.length) products = data;
  render();
}
render();
loadProducts();
