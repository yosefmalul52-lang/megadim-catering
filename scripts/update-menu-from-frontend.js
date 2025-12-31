const fs = require('fs');
const path = require('path');

// Read all component files
const saladsFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/salads/salads.component.ts'), 'utf-8');
const mainDishesFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/main-dishes/main-dishes.component.ts'), 'utf-8');
const sideDishesFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/side-dishes/side-dishes.component.ts'), 'utf-8');
const dessertsFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/desserts/desserts.component.ts'), 'utf-8');
const fishFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/fish/fish.component.ts'), 'utf-8');

let allItems = [];
let currentId = 1;

// Extract salads (38 items)
const saladsMatch = saladsFile.match(/featuredSalads\s*=\s*\[([\s\S]*?)\];/);
if (saladsMatch) {
  const saladsContent = saladsMatch[1];
  const saladPattern = /{\s*id:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"],\s*description:\s*['"]([^'"]+)['"],\s*recommendedServing:\s*['"]([^'"]+)['"],\s*pricePer100g:\s*([\d.]+),\s*imageUrl:\s*['"]([^'"]+)['"],\s*tags:\s*\[([^\]]+)\]/g;
  let match;
  while ((match = saladPattern.exec(saladsContent)) !== null) {
    const [, id, name, description, serving, price, imageUrl, tagsStr] = match;
    const tags = tagsStr.split(',').map(t => t.trim().replace(/['"]/g, ''));
    allItems.push({
      id: String(currentId++),
      name: name,
      category: 'סלטים',
      description: description,
      price: Math.round(parseFloat(price)),
      imageUrl: imageUrl,
      tags: tags,
      isAvailable: true,
      isPopular: tags.includes('פופולרי') || false,
      servingSize: serving,
      updatedAt: new Date().toISOString()
    });
  }
}

// Extract main dishes (13 items)
const mainDishesMatch = mainDishesFile.match(/featuredMainDishes\s*=\s*\[([\s\S]*?)\];/);
if (mainDishesMatch) {
  const mainDishesContent = mainDishesMatch[1];
  const mainDishPattern = /{\s*id:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"],\s*description:\s*['"]([^'"]+)['"],\s*recommendedServing:\s*['"]([^'"]+)['"],\s*pricePer100g:\s*([\d.]+),\s*imageUrl:\s*['"]([^'"]+)['"],\s*tags:\s*\[([^\]]+)\]/g;
  let match;
  while ((match = mainDishPattern.exec(mainDishesContent)) !== null) {
    const [, id, name, description, serving, price, imageUrl, tagsStr] = match;
    const tags = tagsStr.split(',').map(t => t.trim().replace(/['"]/g, ''));
    // Determine category: if it's cholent, use "צ'ולנט", otherwise "מנות עיקריות"
    const category = (name.includes('צ\'ולנט') || name.includes('צולנט')) ? "צ'ולנט" : 'מנות עיקריות';
    allItems.push({
      id: String(currentId++),
      name: name,
      category: category,
      description: description,
      price: Math.round(parseFloat(price) * 4), // Convert to full price
      imageUrl: imageUrl,
      tags: tags,
      isAvailable: true,
      isPopular: tags.includes('פופולרי') || false,
      servingSize: serving,
      updatedAt: new Date().toISOString()
    });
  }
}

// Extract side dishes (5 items)
const sideDishesMatch = sideDishesFile.match(/featuredSideDishes\s*=\s*\[([\s\S]*?)\];/);
if (sideDishesMatch) {
  const sideDishesContent = sideDishesMatch[1];
  const sideDishPattern = /{\s*id:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"],\s*description:\s*['"]([^'"]+)['"],\s*recommendedServing:\s*['"]([^'"]+)['"],\s*pricePer100g:\s*([\d.]+),\s*imageUrl:\s*['"]([^'"]+)['"],\s*tags:\s*\[([^\]]+)\]/g;
  let match;
  while ((match = sideDishPattern.exec(sideDishesContent)) !== null) {
    const [, id, name, description, serving, price, imageUrl, tagsStr] = match;
    const tags = tagsStr.split(',').map(t => t.trim().replace(/['"]/g, ''));
    allItems.push({
      id: String(currentId++),
      name: name,
      category: 'תוספות',
      description: description,
      price: Math.round(parseFloat(price) * 2), // Convert to full price
      imageUrl: imageUrl,
      tags: tags,
      isAvailable: true,
      isPopular: tags.includes('פופולרי') || false,
      servingSize: serving,
      updatedAt: new Date().toISOString()
    });
  }
}

// Extract desserts (5 items)
const dessertsMatch = dessertsFile.match(/featuredDesserts\s*=\s*\[([\s\S]*?)\];/);
if (dessertsMatch) {
  const dessertsContent = dessertsMatch[1];
  const dessertPattern = /{\s*id:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"],\s*description:\s*['"]([^'"]+)['"],\s*recommendedServing:\s*['"]([^'"]+)['"],\s*pricePer100g:\s*([\d.]+),\s*imageUrl:\s*['"]([^'"]+)['"],\s*tags:\s*\[([^\]]+)\]/g;
  let match;
  while ((match = dessertPattern.exec(dessertsContent)) !== null) {
    const [, id, name, description, serving, price, imageUrl, tagsStr] = match;
    const tags = tagsStr.split(',').map(t => t.trim().replace(/['"]/g, ''));
    allItems.push({
      id: String(currentId++),
      name: name,
      category: 'קינוחים',
      description: description,
      price: Math.round(parseFloat(price) * 1.5), // Convert to full price
      imageUrl: imageUrl,
      tags: tags,
      isAvailable: true,
      isPopular: tags.includes('פופולרי') || false,
      servingSize: serving,
      updatedAt: new Date().toISOString()
    });
  }
}

// Extract fish (4 items)
const fishMatch = fishFile.match(/featuredFishDishes\s*=\s*\[([\s\S]*?)\];/);
if (fishMatch) {
  const fishContent = fishMatch[1];
  const fishPattern = /{\s*id:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"],\s*description:\s*['"]([^'"]+)['"],\s*pricePer100g:\s*([\d.]+),\s*imageUrl:\s*['"]([^'"]+)['"],\s*tags:\s*\[([^\]]+)\]/g;
  let match;
  while ((match = fishPattern.exec(fishContent)) !== null) {
    const [, id, name, description, price, imageUrl, tagsStr] = match;
    const tags = tagsStr.split(',').map(t => t.trim().replace(/['"]/g, ''));
    allItems.push({
      id: String(currentId++),
      name: name,
      category: 'דגים',
      description: description,
      price: Math.round(parseFloat(price)),
      imageUrl: imageUrl,
      tags: tags,
      isAvailable: true,
      isPopular: tags.includes('פופולרי') || false,
      servingSize: 'כ-170 גרם',
      updatedAt: new Date().toISOString()
    });
  }
}

// Write to JSON file
const outputPath = path.join(__dirname, '../backend/src/data/menuItems.json');
fs.writeFileSync(outputPath, JSON.stringify(allItems, null, 2), 'utf-8');

console.log(`✅ Updated ${outputPath} with ${allItems.length} menu items`);
console.log(`📊 Items by category:`);
const categoryCounts = {};
allItems.forEach(item => {
  categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
});
Object.entries(categoryCounts).forEach(([cat, count]) => {
  console.log(`   ${cat}: ${count}`);
});

