const fs = require('fs');
const path = require('path');

// Read the JSON file
const jsonPath = path.join(__dirname, '../backend/src/data/menuItems.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Read component files to get pricePer100g values
const saladsFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/salads/salads.component.ts'), 'utf-8');
const mainDishesFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/main-dishes/main-dishes.component.ts'), 'utf-8');
const sideDishesFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/side-dishes/side-dishes.component.ts'), 'utf-8');
const dessertsFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/desserts/desserts.component.ts'), 'utf-8');
const fishFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/fish/fish.component.ts'), 'utf-8');

// Create maps of pricePer100g by item name
const priceMap = {};

// Extract salads prices (for salads, we use pricePer100g as base price)
const saladsMatch = saladsFile.match(/featuredSalads\s*=\s*\[([\s\S]*?)\];/);
if (saladsMatch) {
  const saladsContent = saladsMatch[1];
  const saladPattern = /name:\s*['"]([^'"]+)['"][\s\S]*?pricePer100g:\s*([\d.]+)/g;
  let match;
  while ((match = saladPattern.exec(saladsContent)) !== null) {
    const [, name, price] = match;
    priceMap[name] = { pricePer100g: parseFloat(price), category: 'סלטים' };
  }
}

// Extract main dishes prices (price = pricePer100g * 4)
const mainDishesMatch = mainDishesFile.match(/featuredMainDishes\s*=\s*\[([\s\S]*?)\];/);
if (mainDishesMatch) {
  const mainDishesContent = mainDishesMatch[1];
  const mainDishPattern = /name:\s*['"]([^'"]+)['"][\s\S]*?pricePer100g:\s*([\d.]+)/g;
  let match;
  while ((match = mainDishPattern.exec(mainDishesContent)) !== null) {
    const [, name, price] = match;
    const pricePer100g = parseFloat(price);
    priceMap[name] = { 
      pricePer100g: pricePer100g, 
      price: Math.round(pricePer100g * 4),
      category: name.includes('צ\'ולנט') || name.includes('צולנט') ? 'צ\'ולנט' : 'מנות עיקריות'
    };
  }
}

// Extract side dishes prices (price = pricePer100g * 2)
const sideDishesMatch = sideDishesFile.match(/featuredSideDishes\s*=\s*\[([\s\S]*?)\];/);
if (sideDishesMatch) {
  const sideDishesContent = sideDishesMatch[1];
  const sideDishPattern = /name:\s*['"]([^'"]+)['"][\s\S]*?pricePer100g:\s*([\d.]+)/g;
  let match;
  while ((match = sideDishPattern.exec(sideDishesContent)) !== null) {
    const [, name, price] = match;
    const pricePer100g = parseFloat(price);
    priceMap[name] = { 
      pricePer100g: pricePer100g, 
      price: Math.round(pricePer100g * 2),
      category: 'תוספות'
    };
  }
}

// Extract desserts prices (price = pricePer100g * 1.5)
const dessertsMatch = dessertsFile.match(/featuredDesserts\s*=\s*\[([\s\S]*?)\];/);
if (dessertsMatch) {
  const dessertsContent = dessertsMatch[1];
  const dessertPattern = /name:\s*['"]([^'"]+)['"][\s\S]*?pricePer100g:\s*([\d.]+)/g;
  let match;
  while ((match = dessertPattern.exec(dessertsContent)) !== null) {
    const [, name, price] = match;
    const pricePer100g = parseFloat(price);
    priceMap[name] = { 
      pricePer100g: pricePer100g, 
      price: Math.round(pricePer100g * 1.5),
      category: 'קינוחים'
    };
  }
}

// Extract fish prices (price = 17 for all, or use pricePer100g)
const fishMatch = fishFile.match(/featuredFishDishes\s*=\s*\[([\s\S]*?)\];/);
if (fishMatch) {
  const fishContent = fishMatch[1];
  const fishPattern = /name:\s*['"]([^'"]+)['"][\s\S]*?pricePer100g:\s*([\d.]+)/g;
  let match;
  while ((match = fishPattern.exec(fishContent)) !== null) {
    const [, name, price] = match;
    const pricePer100g = parseFloat(price);
    priceMap[name] = { 
      pricePer100g: pricePer100g, 
      price: Math.round(pricePer100g), // Fish uses pricePer100g directly
      category: 'דגים'
    };
  }
}

// Update prices in JSON
let updated = 0;
data.forEach(item => {
  if (priceMap[item.name]) {
    const priceInfo = priceMap[item.name];
    
    // Update price based on category
    if (item.category === 'מנות עיקריות' || item.category === 'צ\'ולנט') {
      if (priceInfo.price !== undefined) {
        item.price = priceInfo.price;
        updated++;
      }
    } else if (item.category === 'תוספות') {
      if (priceInfo.price !== undefined) {
        item.price = priceInfo.price;
        updated++;
      }
    } else if (item.category === 'קינוחים') {
      if (priceInfo.price !== undefined) {
        item.price = priceInfo.price;
        updated++;
      }
    } else if (item.category === 'דגים') {
      if (priceInfo.price !== undefined) {
        item.price = priceInfo.price;
        updated++;
      }
    } else if (item.category === 'סלטים') {
      // For salads, keep pricePer100g as the base price
      if (priceInfo.pricePer100g !== undefined) {
        item.price = Math.round(priceInfo.pricePer100g);
        updated++;
      }
    }
  }
});

// Write updated JSON
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');

console.log(`✅ Updated ${updated} items with correct prices`);
console.log(`📊 Sample prices:`);
const samples = data.slice(0, 5).concat(data.filter(i => i.category === 'מנות עיקריות').slice(0, 2));
samples.forEach(item => {
  console.log(`   ${item.name} (${item.category}): ${item.price}₪`);
});

