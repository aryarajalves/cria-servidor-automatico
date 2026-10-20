import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Input, { generateRandomUser, generateRandomPassword } from '../Input';

describe('Input Component - Geradores de Usuário e Senha', () => {
    it('generateRandomUser deve retornar uma string de exatamente 7 caracteres', () => {
        const user = generateRandomUser();
        expect(user).toHaveLength(7);
        expect(user).toMatch(/^[a-z][a-z0-9]{6}$/);
    });

    it('generateRandomPassword deve retornar uma string de exatamente 21 caracteres', () => {
        const password = generateRandomPassword();
        expect(password).toHaveLength(21);
    });

    it('deve exibir o botão de gerar usuário para campo com label Usuário e acionar o onChange com 7 caracteres', () => {
        const handleChange = vi.fn();
        render(
            <Input
                label="Usuário Admin"
                name="rabbit_user"
                value=""
                onChange={handleChange}
            />
        );

        const generateBtn = screen.getByTitle('Gerar usuário aleatório de 7 caracteres');
        expect(generateBtn).toBeInTheDocument();

        fireEvent.click(generateBtn);
        expect(handleChange).toHaveBeenCalledTimes(1);
        const callArg = handleChange.mock.calls[0][0];
        expect(callArg.target.name).toBe('rabbit_user');
        expect(callArg.target.value).toHaveLength(7);
    });

    it('deve exibir o botão de gerar senha para campo do tipo password e acionar o onChange com 21 caracteres', () => {
        const handleChange = vi.fn();
        render(
            <Input
                label="Senha Admin"
                name="rabbit_password"
                type="password"
                value=""
                onChange={handleChange}
            />
        );

        const generateBtn = screen.getByTitle('Gerar senha aleatória de 21 caracteres');
        expect(generateBtn).toBeInTheDocument();

        fireEvent.click(generateBtn);
        expect(handleChange).toHaveBeenCalledTimes(1);
        const callArg = handleChange.mock.calls[0][0];
        expect(callArg.target.name).toBe('rabbit_password');
        expect(callArg.target.value).toHaveLength(21);
    });
});
