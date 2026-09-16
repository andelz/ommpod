import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideTranslateLoader,
  provideTranslateService,
  TranslateNoOpLoader,
  TranslateService,
} from '@ngx-translate/core';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  beforeEach(async () => {
    localStorage.removeItem('lang');
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideTranslateService({
          lang: 'en',
          fallbackLang: 'en',
          loader: provideTranslateLoader(TranslateNoOpLoader),
        }),
      ],
    }).compileComponents();
  });

  it('renders the language select and the theme toggle', async () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('omm-select')).toBeTruthy();
    expect(host.querySelector('omm-theme-toggle')).toBeTruthy();
  });

  // omm-select is a ControlValueAccessor, and its declared types disagree
  // with its behaviour: selectionChange/registerOnChange are typed
  // SelectOption<T> but it emits option.value. This pins the round-trip we
  // actually rely on, so a fix upstream can't silently break the binding.
  it('applies the language chosen through the select', async () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    await fixture.whenStable();

    const translate = TestBed.inject(TranslateService);
    const component = fixture.componentInstance;

    component.selectLanguage('de');
    await fixture.whenStable();

    expect(component.currentLang()).toBe('de');
    expect(translate.currentLang).toBe('de');
    expect(localStorage.getItem('lang')).toBe('de');
  });

  it('exposes the three theme labels the toggle requires', async () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    await fixture.whenStable();

    const labels = fixture.componentInstance.themeLabels();
    expect(Object.keys(labels).sort()).toEqual(['dark', 'light', 'system']);
  });

  afterEach(() => localStorage.removeItem('lang'));
});
