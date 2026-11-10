import bcrypt from "bcrypt";
import prisma from "./client.ts";
import usersData from "./data/users.json" with { type: "json" };
import areasData from "./data/areas.json" with { type: "json" };
import categoriesData from "./data/categories.json" with { type: "json" };
import ingredientsData from "./data/ingredients.json" with { type: "json" };
import recipesData from "./data/recipes.json" with { type: "json" };
import testimonialsData from "./data/testimonials.json" with { type: "json" };

type MongoId = string | { $oid: string };

const getId = (id: MongoId): string => {
  return typeof id === "string" ? id : id.$oid;
};

const TEMP_PASSWORD = "FoodiesTest123!";

const seedUsers = async () => {
  const hashedPassword = await bcrypt.hash(TEMP_PASSWORD, 10);

  for (const user of usersData) {
    const id = getId(user._id);

    await prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name: user.name,
        email: user.email,
        password: hashedPassword,
        avatar: user.avatar,
        followers: user.followers,
        following: user.following,
      },
    });
  }

  console.log("Users seeded successfully!");
};

const seedCategories = async () => {
  for (const category of categoriesData) {
    const id = getId(category._id);

    await prisma.category.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name: category.name,
      },
    });
  }

  console.log("Categories seeded successfully!");
};

const seedAreas = async () => {
  for (const area of areasData) {
    const id = getId(area._id);

    await prisma.area.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name: area.name,
      },
    });
  }

  console.log("Areas seeded successfully!");
};

const seedIngredients = async () => {
  for (const ingredient of ingredientsData) {
    const id = getId(ingredient._id);

    await prisma.ingredient.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name: ingredient.name,
        description: ingredient.desc,
        img: ingredient.img,
      },
    });
  }

  console.log("Ingredients seeded successfully!");
};

const seedRecipes = async () => {
  for (const recipe of recipesData) {
    const id = getId(recipe._id);
    const ownerId = getId(recipe.owner);

    await prisma.recipe.upsert({
      where: { id },
      update: {},
      create: {
        id,
        title: recipe.title,
        category: recipe.category,
        area: recipe.area,
        instructions: recipe.instructions,
        description: recipe.description,
        thumb: recipe.thumb,
        time: Number(recipe.time),
        ownerId,
        ingredients: {
          create: recipe.ingredients.map((ingredient) => ({
            measure: ingredient.measure,
            ingredient: {
              connect: {
                id: ingredient.id,
              },
            },
          })),
        },
      },
    });
  }

  console.log("Recipes seeded successfully!");
};

const seedTestimonials = async () => {
  for (const testimonial of testimonialsData) {
    const id = getId(testimonial._id);
    const ownerId = getId(testimonial.owner);

    await prisma.testimonial.upsert({
      where: { id },
      update: {},
      create: {
        id,
        ownerId,
        testimonial: testimonial.testimonial,
      },
    });
  }

  console.log("Testimonials seeded successfully!");
};

const main = async () => {
  try {
    console.log("Starting database seeding...");

    await seedUsers();
    await seedCategories();
    await seedAreas();
    await seedIngredients();
    await seedRecipes();
    await seedTestimonials();

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error during database seeding:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

main();
