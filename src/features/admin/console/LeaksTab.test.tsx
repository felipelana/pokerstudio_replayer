import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import type { AdminLeakRow } from '@/lib/infrastructure/http/adminApi';

/**
 * A tela do catálogo, exercitada sem servidor.
 *
 * O que vale a pena travar aqui são as duas regras que a tela existe para
 * tornar visíveis antes de o administrador tentar: o identificador não se edita
 * depois de criado, e aposentar não apaga. As duas já são garantidas no
 * servidor; um teste de interface impede que a tela prometa o contrário.
 */

const leaks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  retire: vi.fn(),
}));

vi.mock('@/lib/infrastructure/http/adminApi', () => ({
  adminApi: {
    leaks: leaks.list,
    createLeak: leaks.create,
    updateLeak: leaks.update,
    retireLeak: leaks.retire,
  },
}));

const { LeaksTab } = await import('./LeaksTab');

const row = (over: Partial<AdminLeakRow> = {}): AdminLeakRow => ({
  id: 'a1',
  slug: 'overfold',
  label: 'Overfold',
  color: '#4fa3ff',
  hint: 'Desiste demais.',
  active: true,
  position: 10,
  ...over,
});

/** O formulário de criação, que é a única parte da tela que inventa um slug. */
const form = () => within(screen.getByRole('region', { name: 'Novo leak' }));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('pt-BR');
  leaks.list.mockResolvedValue({ items: [row()] });
  leaks.create.mockResolvedValue(row({ id: 'b2', slug: 'bluff-catch' }));
  leaks.update.mockResolvedValue(row());
  leaks.retire.mockResolvedValue(row({ active: false }));
});

describe('a tela do catálogo de leaks', () => {
  it('mostra o que é oferecido a todos, com o identificador à vista', async () => {
    render(<LeaksTab />);
    expect(await screen.findByDisplayValue('Overfold')).toBeTruthy();
    expect(screen.getByText('overfold')).toBeTruthy();
  });

  it('não oferece campo para editar o identificador de quem já existe', async () => {
    render(<LeaksTab />);
    await screen.findByDisplayValue('Overfold');
    // Na linha, o slug é texto. O único campo de identificador da tela é o do
    // formulário de criação, e ele começa vazio.
    const fields = screen.getAllByLabelText('Identificador') as HTMLInputElement[];
    expect(fields).toHaveLength(1);
    expect(fields[0].value).toBe('');
  });

  it('só habilita salvar depois de algo mudar', async () => {
    render(<LeaksTab />);
    const label = (await screen.findByDisplayValue('Overfold')) as HTMLInputElement;
    const save = screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(label, { target: { value: 'Desiste demais' } });
    expect(save.disabled).toBe(false);

    fireEvent.click(save);
    await waitFor(() => expect(leaks.update).toHaveBeenCalled());
    expect(leaks.update.mock.calls[0][0]).toBe('a1');
    expect(leaks.update.mock.calls[0][1].label).toBe('Desiste demais');
    // Renomear não toca no identificador.
    expect(leaks.update.mock.calls[0][1].slug).toBeUndefined();
  });

  it('sugere o identificador a partir do nome, sem acento e sem espaço', async () => {
    render(<LeaksTab />);
    await screen.findByDisplayValue('Overfold');
    fireEvent.change(form().getByLabelText('Nome'), { target: { value: 'Pagar até demais' } });
    expect((form().getByLabelText('Identificador') as HTMLInputElement).value).toBe(
      'pagar-ate-demais',
    );
  });

  it('recusa criar com um identificador que já existe, e diz o motivo', async () => {
    render(<LeaksTab />);
    await screen.findByDisplayValue('Overfold');
    fireEvent.change(form().getByLabelText('Nome'), { target: { value: 'Overfold' } });

    expect(screen.getByText('Já existe um leak com esse identificador.')).toBeTruthy();
    const create = form().getByRole('button', { name: 'Criar' }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    expect(leaks.create).not.toHaveBeenCalled();
  });

  it('pede confirmação antes de aposentar, e diz que nada é apagado', async () => {
    render(<LeaksTab />);
    await screen.findByDisplayValue('Overfold');
    fireEvent.click(screen.getByRole('button', { name: 'Aposentar' }));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/continuam mostrando a marca/)).toBeTruthy();
    expect(leaks.retire).not.toHaveBeenCalled();

    fireEvent.click(dialog.getByRole('button', { name: 'Aposentar' }));
    await waitFor(() => expect(leaks.retire).toHaveBeenCalledWith('a1'));
  });

  it('mostra os aposentados à parte, com a opção de voltar a oferecer', async () => {
    leaks.list.mockResolvedValue({
      items: [row(), row({ id: 'c3', slug: 'spew', active: false })],
    });
    render(<LeaksTab />);

    const retired = within(await screen.findByRole('region', { name: 'Aposentados' }));
    fireEvent.click(retired.getByRole('button', { name: 'Voltar a oferecer' }));
    await waitFor(() => expect(leaks.update).toHaveBeenCalledWith('c3', { active: true }));
  });
});
