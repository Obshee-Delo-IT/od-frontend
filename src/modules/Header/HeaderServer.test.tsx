import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMenus = vi.fn();
const fetchMenuItems = vi.fn();

vi.mock('@/shared/api', () => ({
  fetchMenus: (...args: unknown[]) => fetchMenus(...args),
  fetchMenuItems: (...args: unknown[]) => fetchMenuItems(...args),
}));

import { HeaderServer } from './HeaderServer';

/**
 * The header's nav is two requests: find `main-navigation`, then ask for that
 * menu's items. The second one has to fail *closed* — openapi-fetch drops an
 * array whose every entry is undefined, so `menus: [undefined]` reaches
 * WordPress as an unfiltered `/wp/v2/menu-items` and the answer is every
 * menu's top-level items rather than none (DATA-02).
 */
describe('HeaderServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks for the items of the menu it found', async () => {
    fetchMenus.mockResolvedValue({ data: [{ id: 42 }] });
    fetchMenuItems.mockResolvedValue({ data: [] });

    await HeaderServer();

    expect(fetchMenuItems).toHaveBeenCalledWith({ menus: [42] });
  });

  it('asks for nothing at all when there is no main-navigation menu', async () => {
    fetchMenus.mockResolvedValue({ data: [] });

    const element = await HeaderServer();

    expect(fetchMenuItems).not.toHaveBeenCalled();
    expect(element.props.navItems).toEqual([]);
  });
});
