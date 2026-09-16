import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Select, SelectOption, ThemeToggle, ThemeToggleLabels } from 'omm-ui';
import { map } from 'rxjs';
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
  updateService = inject(UpdateService);

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

  selectLanguage(code: string) {
    this.translate.use(code);
    this.currentLang.set(code);
    localStorage.setItem('lang', code);
  }
}
