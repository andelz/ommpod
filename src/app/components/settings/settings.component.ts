import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Select, SelectOption, ThemeToggle, ThemeToggleLabels } from 'omm-ui';
import { map } from 'rxjs';
import { StorageService, StorageUsage } from '../../services/storage.service';
import { UpdateService } from '../../services/update.service';

const THEME_KEYS = ['settings.theme.light', 'settings.theme.dark', 'settings.theme.system'];

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TranslateModule, FormsModule, Select, ThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private translate = inject(TranslateService);
  private storage = inject(StorageService);
  updateService = inject(UpdateService);

  storageUsage = signal<StorageUsage | null>(null);

  /** `null` while the initial check is in flight, so the UI can stay quiet. */
  persisted = this.storage.persisted;

  languages: SelectOption<string>[] = [
    { label: 'English', value: 'en' },
    { label: 'Deutsch', value: 'de' },
  ];

  currentLang = signal(this.translate.currentLang ?? this.translate.defaultLang ?? 'en');

  /** `stream` re-emits both when the catalogue loads and when the language
   *  changes, so the toggle's labels stay correct without a manual refresh. */
  themeLabels = toSignal(
    this.translate.stream(THEME_KEYS).pipe(
      map((t): ThemeToggleLabels => {
        const dict = t as Record<string, string>;
        return {
          light: dict['settings.theme.light'],
          dark: dict['settings.theme.dark'],
          system: dict['settings.theme.system'],
        };
      }),
    ),
    { initialValue: { light: 'Light', dark: 'Dark', system: 'System' } },
  );

  constructor() {
    void this.refreshStorage();
  }

  selectLanguage(code: string) {
    this.translate.use(code);
    this.currentLang.set(code);
    localStorage.setItem('lang', code);
  }

  /**
   * Asking from a real click is the one moment Firefox's prompt makes sense to
   * the user, and Chrome's silent heuristic has the most to go on.
   */
  async requestPersistence(): Promise<void> {
    await this.storage.claimPersistence();
    await this.refreshStorage();
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit++;
    }
    return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
  }

  private async refreshStorage(): Promise<void> {
    this.storageUsage.set(await this.storage.estimate());
  }
}
