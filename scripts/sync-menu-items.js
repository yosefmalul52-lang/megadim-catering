const fs = require('fs');
const path = require('path');

// Read the salads component file
const saladsPath = path.join(__dirname, '../frontend/src/app/components/pages/ready-for-shabbat/salads/salads.component.ts');
const saladsContent = fs.readFileSync(saladsPath, 'utf-8');

// Extract featuredSalads array
const saladsMatch = saladsContent.match(/featuredSalads\s*=\s*\[([\s\S]*?)\];/);
if (!saladsMatch) {
  console.error('❌ Could not find featuredSalads in salads component');
  process.exit(1);
}

// Parse the salads (simplified - we'll need to manually extract or use a better parser)
// For now, let's create a script that extracts all items from the frontend components

console.log('📋 Starting menu items sync from frontend...');

// Read all component files that might contain menu items
const componentFiles = [
  'frontend/src/app/components/pages/ready-for-shabbat/salads/salads.component.ts',
  'frontend/src/app/components/pages/ready-for-shabbat/side-dishes/side-dishes.component.ts',
  'frontend/src/app/components/pages/ready-for-shabbat/desserts/desserts.component.ts',
  'frontend/src/app/components/pages/ready-for-shabbat/main-dishes/main-dishes.component.ts',
  'frontend/src/app/components/pages/ready-for-shabbat/fish/fish.component.ts',
  'frontend/src/app/components/pages/cholent-bar/cholent-bar.component.ts',
  'frontend/src/app/components/pages/holiday-food/holiday-food.component.ts'
];

let allMenuItems = [];
let currentId = 1;

// Helper function to extract items from a component file
function extractItemsFromComponent(filePath, category) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return [];
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  
  // Try to find featured arrays (featuredSalads, featuredDesserts, etc.)
  const featuredMatch = content.match(/featured\w+\s*=\s*\[([\s\S]*?)\];/);
  if (featuredMatch) {
    // This is a simplified extraction - in reality, we'd need a proper TypeScript parser
    console.log(`✅ Found items in ${filePath}`);
    // For now, we'll need to manually extract or use a better approach
  }
  
  return [];
}

// For now, let's create a comprehensive list based on what we know
// We'll extract the salads first since we know there are 38

console.log('📝 Extracting salads from component...');

// Read salads component and extract the featuredSalads array manually
const saladsFile = fs.readFileSync(saladsPath, 'utf-8');

// Extract each salad item using regex
const saladItems = [];
const saladPattern = /{\s*id:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"],\s*description:\s*['"]([^'"]+)['"],\s*recommendedServing:\s*['"]([^'"]+)['"],\s*pricePer100g:\s*([\d.]+),\s*imageUrl:\s*['"]([^'"]+)['"],\s*tags:\s*\[([^\]]+)\]/g;

let match;
while ((match = saladPattern.exec(saladsFile)) !== null) {
  const [, id, name, description, recommendedServing, pricePer100g, imageUrl, tagsStr] = match;
  
  // Parse tags
  const tags = tagsStr.split(',').map(t => t.trim().replace(/['"]/g, ''));
  
  saladItems.push({
    id: String(currentId++),
    name: name,
    category: 'סלטים',
    description: description,
    price: Math.round(parseFloat(pricePer100g) * 1), // Base price for 100g
    imageUrl: imageUrl,
    tags: tags,
    isAvailable: true,
    isPopular: tags.includes('פופולרי') || false,
    servingSize: recommendedServing,
    updatedAt: new Date().toISOString()
  });
}

console.log(`✅ Extracted ${saladItems.length} salads`);

allMenuItems = [...allMenuItems, ...saladItems];

// Write to JSON file
const outputPath = path.join(__dirname, '../backend/src/data/menuItems.json');
fs.writeFileSync(outputPath, JSON.stringify(allMenuItems, null, 2), 'utf-8');

console.log(`✅ Updated ${outputPath} with ${allMenuItems.length} menu items`);
console.log(`📊 Items by category:`);
const categoryCounts = {};
allMenuItems.forEach(item => {
  categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
});
Object.entries(categoryCounts).forEach(([cat, count]) => {
  console.log(`   ${cat}: ${count}`);
});

