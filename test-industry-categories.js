// test-industry-categories.js
require("dotenv").config();
const { sequelize, Product, Service, Tourism, Funding, Event, Job, IndustryCategory, IndustrySubcategory, IndustrySubsubCategory } = require("./src/models");

async function testIndustryCategories() {
  try {
    await sequelize.authenticate();
    console.log("🔌 DB connected (testing industry categories).");

    // Create test industry categories
    const testIndustryCategory = await IndustryCategory.create({
      name: "Test Industry Category"
    });
    console.log("✅ Created test industry category:", testIndustryCategory.name);

    const testIndustrySubcategory = await IndustrySubcategory.create({
      name: "Test Industry Subcategory",
      industryCategoryId: testIndustryCategory.id
    });
    console.log("✅ Created test industry subcategory:", testIndustrySubcategory.name);

    const testIndustrySubsubCategory = await IndustrySubsubCategory.create({
      name: "Test Industry Subsubcategory",
      industrySubcategoryId: testIndustrySubcategory.id
    });
    console.log("✅ Created test industry subsubcategory:", testIndustrySubsubCategory.name);

    // Create a test product with industry category associations
    const testProduct = await Product.create({
      title: "Test Product with Industry Categories",
      description: "This is a test product to verify industry category associations",
      price: 99.99,
      quantity: 10,
      country: "Test Country",
      tags: ["test", "industry", "categories"],
      images: ["https://example.com/test-image.jpg"],
      sellerUserId: (await sequelize.query("SELECT id FROM users LIMIT 1"))[0][0].id,
      industryCategoryId: testIndustryCategory.id,
      industrySubcategoryId: testIndustrySubcategory.id,
      industrySubsubCategoryId: testIndustrySubsubCategory.id
    });
    console.log("✅ Created test product:", testProduct.title);

    // Retrieve the product with its industry categories
    const productWithIndustryCategories = await Product.findOne({
      where: { id: testProduct.id },
      include: [
        { model: IndustryCategory, as: "industryCategory" },
        { model: IndustrySubcategory, as: "industrySubcategory" },
        { model: IndustrySubsubCategory, as: "industrySubsubCategory" }
      ]
    });

    // Verify industry category associations
    console.log("\n🔍 Verifying industry category associations:");
    console.log("Product:", productWithIndustryCategories.title);
    console.log("Industry Category:", productWithIndustryCategories.industryCategory?.name || "Not set");
    console.log("Industry Subcategory:", productWithIndustryCategories.industrySubcategory?.name || "Not set");
    console.log("Industry Subsubcategory:", productWithIndustryCategories.industrySubsubCategory?.name || "Not set");

    // Clean up test data
    await testProduct.destroy();
    await testIndustrySubsubCategory.destroy();
    await testIndustrySubcategory.destroy();
    await testIndustryCategory.destroy();
    console.log("\n🧹 Cleaned up test data");

    console.log("\n✅ Industry category associations are working correctly!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  }
}

testIndustryCategories();