import Joi from "joi";

export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const contentGenerationSchema = Joi.object({
  business_name: Joi.string().min(1).max(100).required(),
  location: Joi.string().min(1).max(100).required(),
  business_type: Joi.string().min(1).max(50).required(),
  custom_business_type: Joi.string().min(1).max(100).optional().allow(""),
  products_services: Joi.string().max(500).optional().allow(""),
  target_customers: Joi.string().max(500).optional().allow(""),
});

export const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  preferences: Joi.object({
    theme: Joi.string().valid("light", "dark", "system").optional(),
    language: Joi.string().max(10).optional(),
  }).optional(),
});

export const ratingSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  feedback: Joi.string().max(1000).optional().allow(""),
});
