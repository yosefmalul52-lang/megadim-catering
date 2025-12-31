const fs = require('fs');
const path = require('path');

// Read component files
const saladsFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/salads/salads.component.ts'), 'utf-8');
const mainDishesFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/main-dishes/main-dishes.component.ts'), 'utf-8');
const sideDishesFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/side-dishes/side-dishes.component.ts'), 'utf-8');
const dessertsFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/desserts/desserts.component.ts'), 'utf-8');
const fishFile = fs.readFileSync(path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/fish/fish.component.ts'), 'utf-8');

// Helper function to extract items from component file
function extractItems(fileContent, arrayName) {
  const regex = new RegExp(`${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\];`, 'g');
  const match = regex.exec(fileContent);
  if (!match) return [];
  
  const itemsContent = match[1];
  const items = [];
  let currentItem = null;
  let inItem = false;
  let braceCount = 0;
  let currentLine = '';
  
  for (let i = 0; i < itemsContent.length; i++) {
    const char = itemsContent[i];
    currentLine += char;
    
    if (char === '{' && !inItem) {
      inItem = true;
      currentItem = {};
      braceCount = 1;
      currentLine = '{';
    } else if (char === '{') {
      braceCount++;
      currentLine += char;
    } else if (char === '}') {
      braceCount--;
      currentLine += char;
      
      if (braceCount === 0 && inItem) {
        // Parse the item
        try {
          // Extract id
          const idMatch = currentLine.match(/id:\s*['"]([^'"]+)['"]/);
          const nameMatch = currentLine.match(/name:\s*['"]([^'"]+)['"]/);
          const descMatch = currentLine.match(/description:\s*['"]([^'"]+)['"]/);
          const servingMatch = currentLine.match(/recommendedServing:\s*['"]([^'"]+)['"]/);
          const priceMatch = currentLine.match(/pricePer100g:\s*([\d.]+)/);
          const imageMatch = currentLine.match(/imageUrl:\s*['"]([^'"]+)['"]/);
          const tagsMatch = currentLine.match(/tags:\s*\[([^\]]+)\]/);
          
          if (idMatch && nameMatch) {
            const item = {
              id: idMatch[1],
              name: nameMatch[1],
              description: descMatch ? descMatch[1] : '',
              recommendedServing: servingMatch ? servingMatch[1] : '',
              pricePer100g: priceMatch ? parseFloat(priceMatch[1]) : 0,
              imageUrl: imageMatch ? imageMatch[1] : '',
              tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '')) : []
            };
            items.push(item);
          }
        } catch (e) {
          console.error('Error parsing item:', e);
        }
        
        inItem = false;
        currentItem = null;
        currentLine = '';
      }
    }
  }
  
  return items;
}

// Extract all items
const salads = extractItems(saladsFile, 'featuredSalads');
const mainDishes = extractItems(mainDishesFile, 'featuredMainDishes');
const sideDishes = extractItems(sideDishesFile, 'featuredSideDishes');
const desserts = extractItems(dessertsFile, 'featuredDesserts');
const fish = extractItems(fishFile, 'featuredFishDishes');

// Helper to calculate price from pricePer100g and serving size
function calculatePrice(pricePer100g, servingStr) {
  if (!servingStr) return Math.round(pricePer100g);
  
  // Extract number from serving string (e.g., "כ-300 גרם" -> 300)
  const match = servingStr.match(/(\d+)/);
  if (match) {
    const grams = parseInt(match[1]);
    return Math.round((pricePer100g / 100) * grams);
  }
  
  return Math.round(pricePer100g);
}

// Build complete menu items array
let allItems = [];
let currentId = 1;

// Add salads
salads.forEach(salad => {
  allItems.push({
    id: String(currentId++),
    name: salad.name,
    category: 'סלטים',
    description: salad.description,
    price: Math.round(salad.pricePer100g),
    imageUrl: salad.imageUrl,
    tags: salad.tags,
    isAvailable: true,
    isPopular: salad.tags.includes('פופולרי') || false,
    servingSize: salad.recommendedServing,
    updatedAt: new Date().toISOString()
  });
});

// Add main dishes (excluding cholent)
mainDishes.forEach(dish => {
  if (dish.name.includes('צ\'ולנט') || dish.name.includes('צולנט')) {
    // Skip cholent for now, will add separately
    return;
  }
  
  allItems.push({
    id: String(currentId++),
    name: dish.name,
    category: 'מנות עיקריות',
    description: dish.description,
    price: calculatePrice(dish.pricePer100g, dish.recommendedServing),
    imageUrl: dish.imageUrl,
    tags: dish.tags,
    isAvailable: true,
    isPopular: dish.tags.includes('פופולרי') || false,
    servingSize: dish.recommendedServing,
    updatedAt: new Date().toISOString()
  });
});

// Add cholent
mainDishes.forEach(dish => {
  if (dish.name.includes('צ\'ולנט') || dish.name.includes('צולנט')) {
    const isParve = dish.name.includes('פרווה');
    allItems.push({
      id: String(currentId++),
      name: dish.name,
      category: 'צ\'ולנט',
      description: dish.description,
      price: calculatePrice(dish.pricePer100g, dish.recommendedServing),
      imageUrl: dish.imageUrl,
      tags: dish.tags,
      isAvailable: true,
      isPopular: true,
      servingSize: dish.recommendedServing,
      updatedAt: new Date().toISOString()
    });
  }
});

// Add side dishes
sideDishes.forEach(side => {
  allItems.push({
    id: String(currentId++),
    name: side.name,
    category: 'תוספות',
    description: side.description,
    price: calculatePrice(side.pricePer100g, side.recommendedServing),
    imageUrl: side.imageUrl,
    tags: side.tags,
    isAvailable: true,
    isPopular: side.tags.includes('פופולרי') || false,
    servingSize: side.recommendedServing,
    updatedAt: new Date().toISOString()
  });
});

// Add desserts
desserts.forEach(dessert => {
  allItems.push({
    id: String(currentId++),
    name: dessert.name,
    category: 'קינוחים',
    description: dessert.description,
    price: calculatePrice(dessert.pricePer100g, dessert.recommendedServing),
    imageUrl: dessert.imageUrl,
    tags: dessert.tags,
    isAvailable: true,
    isPopular: dessert.tags.includes('פופולרי') || false,
    servingSize: dessert.recommendedServing,
    updatedAt: new Date().toISOString()
  });
});

// Add fish
fish.forEach(f => {
  allItems.push({
    id: String(currentId++),
    name: f.name,
    category: 'דגים',
    description: f.description,
    price: Math.round(f.pricePer100g),
    imageUrl: f.imageUrl,
    tags: f.tags,
    isAvailable: true,
    isPopular: f.tags.includes('פופולרי') || false,
    servingSize: 'כ-170 גרם',
    updatedAt: new Date().toISOString()
  });
});

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

