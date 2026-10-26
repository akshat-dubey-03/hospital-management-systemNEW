// src/modules/departments/departments.routes.js
// DEPARTMENT APIs. Any signed-in user can list departments (doctor discovery
// filter); only ADMIN can create, rename or delete them.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { validate, validateParams } from '../../middleware/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const router = Router();

const idSchema = z.object({ id: z.string().uuid('Invalid department id.') });
const departmentSchema = z.object({
  name: z.string({ required_error: 'Name is required.' }).trim().min(2, 'Name must be at least 2 characters.').max(100),
  description: z.string().trim().max(2000).optional().nullable(),
});
const updateSchema = departmentSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Nothing to update.',
});

// GET /api/departments
router.get('/', authMiddleware, async (_req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { doctors: true } } },
    });
    // Active-doctor counts in one grouped query.
    const active = await prisma.doctor.groupBy({ by: ['departmentId'], where: { isActive: true }, _count: { _all: true } });
    const activeMap = new Map(active.map((row) => [row.departmentId, row._count._all]));

    new ApiResponse(200, {
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        createdAt: d.createdAt,
        doctorCount: d._count.doctors,
        activeDoctorCount: activeMap.get(d.id) ?? 0,
      })),
    }).send(res);
  } catch (err) {
    next(err);
  }
});

// POST /api/departments
router.post('/', authMiddleware, roleGuard('ADMIN'), validate(departmentSchema), async (req, res, next) => {
  try {
    await assertNameFree(req.body.name);
    const department = await prisma.department.create({
      data: { name: req.body.name, description: req.body.description || null },
    });
    new ApiResponse(201, { department }, 'Department created.').send(res);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/departments/:id
router.patch('/:id', authMiddleware, roleGuard('ADMIN'), validateParams(idSchema), validate(updateSchema), async (req, res, next) => {
  try {
    if (req.body.name) await assertNameFree(req.body.name, req.params.id);
    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.description !== undefined) data.description = req.body.description || null;
    const department = await prisma.department.update({ where: { id: req.params.id }, data });
    new ApiResponse(200, { department }, 'Department updated.').send(res);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/departments/:id — refused while any doctor (active or not)
// belongs to it; doctors.departmentId is ON DELETE RESTRICT in the database.
router.delete('/:id', authMiddleware, roleGuard('ADMIN'), validateParams(idSchema), async (req, res, next) => {
  try {
    const doctors = await prisma.doctor.count({ where: { departmentId: req.params.id } });
    if (doctors > 0) {
      throw ApiError.conflict(`This department still has ${doctors} doctor(s). Move or remove them first.`);
    }
    await prisma.department.delete({ where: { id: req.params.id } });
    new ApiResponse(200, null, 'Department deleted.').send(res);
  } catch (err) {
    next(err);
  }
});

async function assertNameFree(name, exceptId) {
  const clash = await prisma.department.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw ApiError.conflict('A department with this name already exists.');
}

export default router;
