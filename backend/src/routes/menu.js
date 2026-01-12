const express = require('express');
// Import MenuItem from TypeScript module
// After compilation, this will work with the compiled JS output
const menuItemModule = require('../models/menuItem');
const MenuItem = menuItemModule.default || menuItemModule;

const router = express.Router();

// GET route to fetch all menu items
router.get('/', async (req, res) => {
  try {
    const menuItems = await MenuItem.find({});
    
    res.status(200).json({
      success: true,
      data: menuItems,
      count: menuItems.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu items',
      message: error.message
    });
  }
});

// GET route to fetch items by category
router.get('/category/:categoryName', async (req, res) => {
  try {
    const { categoryName } = req.params;
    
    if (!categoryName) {
      return res.status(400).json({
        success: false,
        error: 'Category name is required'
      });
    }
    
    const menuItems = await MenuItem.find({ category: categoryName });
    
    res.status(200).json({
      success: true,
      data: menuItems,
      count: menuItems.length,
      category: categoryName,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching menu items by category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu items by category',
      message: error.message
    });
  }
});

// POST route to create a new menu item (Protected)
router.post('/', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const itemData = req.body;
    
    // Validate required fields
    if (!itemData.name || !itemData.category) {
      return res.status(400).json({
        success: false,
        error: 'Name and category are required'
      });
    }
    
    // Validate that either price or pricingVariants is provided
    const hasPrice = itemData.price !== undefined && itemData.price !== null;
    const hasVariants = itemData.pricingVariants && Array.isArray(itemData.pricingVariants) && itemData.pricingVariants.length > 0;
    
    if (!hasPrice && !hasVariants) {
      return res.status(400).json({
        success: false,
        error: 'Either price or pricingVariants must be provided'
      });
    }
    
    // Create new menu item
    const newItem = new MenuItem(itemData);
    const savedItem = await newItem.save();
    
    res.status(201).json({
      success: true,
      data: savedItem,
      message: 'Menu item created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create menu item',
      message: error.message
    });
  }
});

// PUT route to update an existing menu item by ID (Protected)
router.put('/:id', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Item ID is required'
      });
    }
    
    // Validate that either price or pricingVariants is provided (if updating pricing)
    if (updateData.price === undefined && updateData.pricingVariants === undefined) {
      // If neither is provided, keep existing pricing structure
    } else {
      const hasPrice = updateData.price !== undefined && updateData.price !== null;
      const hasVariants = updateData.pricingVariants && Array.isArray(updateData.pricingVariants) && updateData.pricingVariants.length > 0;
      
      // If both are being set, prefer variants and remove price
      if (hasVariants) {
        updateData.price = undefined;
      } else if (hasPrice) {
        updateData.pricingVariants = undefined;
      }
    }
    
    // Update the menu item
    const updatedItem = await MenuItem.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!updatedItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: updatedItem,
      message: 'Menu item updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update menu item',
      message: error.message
    });
  }
});

// DELETE route to remove a menu item by ID (Protected)
router.delete('/:id', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Item ID is required'
      });
    }
    
    const deletedItem = await MenuItem.findByIdAndDelete(id);
    
    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: deletedItem,
      message: 'Menu item deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete menu item',
      message: error.message
    });
  }
});

module.exports = router;

