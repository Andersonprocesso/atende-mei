import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';

// Fluxo crítico: login só passa com credenciais válidas e emite JWT
// com tenantId (base do isolamento multi-tenant).
describe('AuthService', () => {
  let service: AuthService;
  let prisma: { usuario: { findFirst: jest.Mock; findUnique: jest.Mock } };

  const senha = 'segredo123';

  beforeEach(async () => {
    prisma = {
      usuario: { findFirst: jest.fn(), findUnique: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('jwt-token') },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('emite token com tenantId quando a senha confere', async () => {
    const senhaHash = await bcrypt.hash(senha, 10);
    prisma.usuario.findFirst.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      email: 'a@b.com',
      role: 'ADMIN',
      senhaHash,
      ativo: true,
    });

    const res = await service.login({ email: 'a@b.com', senha });
    expect(res.access_token).toBe('jwt-token');
    expect(res.usuario.tenantId).toBe('t1');
  });

  it('rejeita senha incorreta', async () => {
    const senhaHash = await bcrypt.hash(senha, 10);
    prisma.usuario.findFirst.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      email: 'a@b.com',
      role: 'ADMIN',
      senhaHash,
      ativo: true,
    });

    await expect(
      service.login({ email: 'a@b.com', senha: 'errada' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita usuário inexistente', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(
      service.login({ email: 'x@y.com', senha }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
