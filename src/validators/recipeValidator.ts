export interface RecipeQuery {
  page: number;
  limit: number;
  category?: string;
  area?: string;
  ingredientId?: string;
  ownerId?: string;
}

interface FieldError {
  field: string;
  message: string;
}

export const parseRecipeId = (value: unknown) => {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) {
    return null;
  }
  return value.toLowerCase();
};

export const parseRecipeQuery = (
  input: Record<string, unknown>,
  allowedFields = ["page", "limit", "category", "area", "ingredientId", "ownerId"],
) => {
  const errors: FieldError[] = [];

  for (const field of Object.keys(input)) {
    if (!allowedFields.includes(field)) {
      errors.push({ field, message: "Unknown query parameter" });
    }
  }

  const readString = (field: string) => {
    const value = input[field];
    if (value === undefined) return undefined;
    if (typeof value !== "string") {
      errors.push({ field, message: "Must be a single value" });
      return undefined;
    }
    return value.trim();
  };

  const readNumber = (field: string, fallback: number, maximum: number) => {
    const value = readString(field);
    if (value === undefined) return fallback;

    const number = Number(value);
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(number) || number > maximum) {
      errors.push({ field, message: `Must be an integer from 1 to ${maximum}` });
      return fallback;
    }
    return number;
  };

  const query: RecipeQuery = {
    page: readNumber("page", 1, 2147483647),
    limit: readNumber("limit", 9, 100),
  };

  for (const field of ["category", "area"] as const) {
    const value = readString(field);
    if (value && value.length > 100) {
      errors.push({ field, message: "Must contain at most 100 characters" });
    }
    if (value) query[field] = value;
  }

  for (const field of ["ingredientId", "ownerId"] as const) {
    const value = readString(field);
    if (value && !/^[a-f\d]{24}$/i.test(value)) {
      errors.push({ field, message: "Must contain 24 hexadecimal characters" });
    }
    if (value) query[field] = value.toLowerCase();
  }

  if ((query.page - 1) * query.limit > 2147483647) {
    errors.push({ field: "page", message: "Page offset is too large" });
  }

  return { query, errors };
};
