import { useMantineTheme, useMantineColorScheme } from '@mantine/core'

export function useDiagramColors() {
    const theme = useMantineTheme()
    const { colorScheme } = useMantineColorScheme()
    const dark = colorScheme === 'dark'

    return {
        borderColor: dark ? theme.colors.dark[4] : theme.colors.gray[4],
        surfaceColor: dark ? theme.colors.dark[7] : theme.colors.gray[0],
        textColor: dark ? theme.colors.gray[3] : theme.colors.dark[7],
        mutedColor: dark ? theme.colors.dark[3] : theme.colors.gray[5],
        highlightColor: theme.colors.blue[5],
        highlightBg: dark ? theme.colors.blue[9] : theme.colors.blue[0],
        highlightText: dark ? theme.colors.blue[3] : theme.colors.blue[7],
        failColor: theme.colors.red[6],
        successColor: theme.colors.green[6],
        successBg: dark ? theme.colors.green[9] : theme.colors.green[0],
        stepColors: {
            step: theme.colors.blue[5],
            'safe-dep': theme.colors.green[5],
            dep: theme.colors.orange[5],
            strategy: theme.colors.violet[5],
        } as Record<string, string>,
    }
}
