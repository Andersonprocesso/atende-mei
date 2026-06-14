import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/auth-user';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    // email é único por tenant; aqui o login é global por email.
    // Em produção, ou exige-se um identificador de tenant no login, ou
    // o email é único globalmente. Mantemos simples: primeiro match ativo.
    const usuario = await this.prisma.usuario.findFirst({
      where: { email: dto.email, ativo: true },
    });
    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');

    const ok = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    const payload: AuthUser = {
      sub: usuario.id,
      tenantId: usuario.tenantId,
      email: usuario.email,
      role: usuario.role,
    };

    const access_token = await this.jwt.signAsync(payload);
    return {
      access_token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        tenantId: usuario.tenantId,
      },
    };
  }

  async me(user: AuthUser) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: user.sub },
      select: { id: true, nome: true, email: true, role: true, tenantId: true },
    });
    if (!usuario) throw new UnauthorizedException();
    return usuario;
  }
}
